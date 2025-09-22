const Subscriber = require('../models/Subscriber');
const emailService = require('../services/emailService');


exports.subscribe = async (req, res) => {
  try {
    const { email, name, consent, source } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Upsert by email to avoid duplicates
    // Ensure a token exists
    const subscriber = await Subscriber.findOneAndUpdate(
      { email: email.toLowerCase() },
      {
        $set: {
          email: email.toLowerCase(),
          name: name || undefined,
          consent: !!consent,
          source: source || 'footer',
          unsubscribedAt: null
        },
        $setOnInsert: { unsubscribeToken: require('crypto').randomUUID() }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Send welcome email with per-user unsubscribe link (best-effort)
    try {
      const base = (process.env.BACKEND_PUBLIC_URL || process.env.BACKEND_URL || '').replace(/\/$/, '');
      const unsub = `${base}/api/subscriptions/unsubscribe/${subscriber.unsubscribeToken}`;
      if (typeof emailService.sendSubscriptionWelcome === 'function') {
        await emailService.sendSubscriptionWelcome(subscriber.email, unsub);
      } else {
        await emailService.sendWelcomeEmail(subscriber.email, subscriber.name || 'Subscriber');
      }
    } catch (e) {
      // ignore email errors
    }

    return res.status(200).json({ success: true, data: subscriber });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Helper to append unsubscribe footer with per-user token
function appendUnsub(content, token) {
  const base = process.env.BACKEND_PUBLIC_URL || process.env.BACKEND_URL || '';
  const link = `${base.replace(/\/$/, '')}/api/subscriptions/unsubscribe/${token || '{token}'}`;
  const footer = `
    <div style="margin-top:24px;color:#6b7280;font-size:12px">
      If you no longer wish to receive these emails, you can
      <a href="${link}">unsubscribe here</a>.
    </div>
  `;
  if (!content) return footer;
  if (content.includes('</body>')) return content.replace('</body>', `${footer}</body>`);
  return `${content}${footer}`;
}

function decodeHtmlEntities(s) {
  if (!s) return s;
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

exports.unsubscribe = async (req, res) => {
  try {
    const { email, token } = req.body;
    let query = {};
    if (token) {
      query = { unsubscribeToken: token };
    } else if (email) {
      query = { email: email.toLowerCase() };
    } else {
      return res.status(400).json({ success: false, message: 'Email or token is required' });
    }

    const subscriber = await Subscriber.findOneAndUpdate(
      query,
      { $set: { unsubscribedAt: new Date() } },
      { new: true }
    );

    if (!subscriber) {
      return res.status(404).json({ success: false, message: 'Subscriber not found' });
    }

    return res.status(200).json({ success: true, data: subscriber });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Public one-click unsubscribe via token in URL
exports.unsubscribeByToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ success: false, message: 'Token required' });
    const subscriber = await Subscriber.findOneAndUpdate(
      { unsubscribeToken: token },
      { $set: { unsubscribedAt: new Date() } },
      { new: true }
    );
    if (!subscriber) return res.status(404).json({ success: false, message: 'Invalid token' });
    return res.status(200).json({ success: true, message: 'Unsubscribed successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: list subscribers (basic; could add auth middleware later)
exports.list = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = {};
    if (status === 'active') {
      query.unsubscribedAt = null;
    }
    if (status === 'unsubscribed') {
      query.unsubscribedAt = { $ne: null };
    }

    const subscribers = await Subscriber.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Subscriber.countDocuments(query);

    return res.status(200).json({ success: true, data: subscribers, total });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: broadcast an offer to all active subscribers (batched)
exports.broadcast = async (req, res) => {
  try {
    const { subject, html, text } = req.body;
    if (!subject || (!html && !text)) {
      return res.status(400).json({ success: false, message: 'subject and html or text are required' });
    }

    // Fetch active subscribers only
    const Subscriber = require('../models/Subscriber');
    const cursor = (await Subscriber.find({ unsubscribedAt: null }).cursor());

    let sent = 0, failed = 0, recipients = 0;
    const transporter = await emailService.createTransporter();
    if (!transporter) {
      return res.status(503).json({ success: false, message: 'Email service not configureds' });
    }

    for await (const sub of cursor) {
      recipients++;
      const decoded = decodeHtmlEntities(html || text || '');
      const htmlContent = appendUnsub(decoded, sub.unsubscribeToken);
      try {
        const unsubscribeUrl = `${(process.env.BACKEND_PUBLIC_URL || process.env.BACKEND_URL || '').replace(/\/$/,'')}/api/subscriptions/unsubscribe/${sub.unsubscribeToken}`;
        const textAlt = htmlContent
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ') // collapse whitespace
          .trim();
        await transporter.sendMail({
          from: `"Your Business" <${process.env.GMAIL_USER}>`,
          to: sub.email,
          subject,
          html: htmlContent,
          text: textAlt,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`
          }
        });
        sent++;
      } catch (e) {
        failed++;
      }
      // polite delay to avoid throttling
      await new Promise(r => setTimeout(r, 150));
    }

    return res.status(200).json({ success: true, sent, failed, recipients });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: backfill existing registered users into Subscribers
exports.backfill = async (req, res) => {
  try {
    const User = require('../models/User');
    const users = await User.find({ role: 'user', email: { $ne: null } }).select('name email');
    let created = 0, updated = 0, skipped = 0;
    for (const u of users) {
      try {
        const existing = await Subscriber.findOne({ email: u.email.toLowerCase() });
        if (existing) {
          // Ensure not unsubscribed and name filled
          const resUpdate = await Subscriber.updateOne(
            { _id: existing._id },
            { $set: { name: existing.name || u.name || undefined } }
          );
          skipped += 1;
          continue;
        }
        await Subscriber.findOneAndUpdate(
          { email: u.email.toLowerCase() },
          {
            $set: { email: u.email.toLowerCase(), name: u.name || undefined, consent: true, source: 'import', unsubscribedAt: null },
            $setOnInsert: { unsubscribeToken: require('crypto').randomUUID() }
          },
          { upsert: true, new: true }
        );
        created += 1;
      } catch (e) {
        // continue
      }
    }
    return res.status(200).json({ success: true, created, updated, skipped, totalScanned: users.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


