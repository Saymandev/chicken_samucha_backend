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
      return res.status(503).json({ success: false, message: 'Email service not configured' });
    }

    for await (const sub of cursor) {
      recipients++;
      const unsubBase = (process.env.BACKEND_PUBLIC_URL || process.env.BACKEND_URL || '').replace(/\/$/, '');
      const unsubLink = `${unsubBase}/api/subscriptions/unsubscribe/${sub.unsubscribeToken}`;
      const footer = `\n<div style=\"margin-top:24px;color:#6b7280;font-size:12px\">If you no longer wish to receive these emails, you can <a href=\"${unsubLink}\">unsubscribe here</a>.</div>`;
      const htmlContent = (html || text || '') + footer;
      try {
        await transporter.sendMail({
          from: `"Your Business" <${process.env.GMAIL_USER}>`,
          to: sub.email,
          subject,
          html: htmlContent,
          headers: {
            'List-Unsubscribe': `<${unsubLink}>`
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


