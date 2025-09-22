const Campaign = require('../models/Campaign');
const Subscriber = require('../models/Subscriber');
const emailService = require('../services/emailService');

exports.create = async (req, res) => {
  try {
    const { name, subject, html, text, filters, scheduledFor } = req.body;
    const campaign = await Campaign.create({
      name,
      subject,
      html,
      text,
      filters: filters || {},
      status: scheduledFor ? 'scheduled' : 'draft',
      scheduledFor: scheduledFor || null,
      createdBy: req.user?._id
    });
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.list = async (req, res) => {
  try {
    const items = await Campaign.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendNow = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    const transporter = await emailService.createTransporter();
    if (!transporter) return res.status(503).json({ success: false, message: 'Email service not configured' });

    // Build filters
    const query = { unsubscribedAt: null };
    const f = campaign.filters || {};
    if (f.source && Array.isArray(f.source) && f.source.length) {
      query.source = { $in: f.source };
    }
    if (f.joinedAfter) {
      query.createdAt = { ...(query.createdAt || {}), $gte: new Date(f.joinedAfter) };
    }
    if (f.joinedBefore) {
      query.createdAt = { ...(query.createdAt || {}), $lte: new Date(f.joinedBefore) };
    }

    const cursor = (await Subscriber.find(query).cursor());
    let sent = 0, failed = 0, recipients = 0;

    for await (const sub of cursor) {
      recipients++;
      try {
        const html = appendUnsub(campaign.html || campaign.text, sub.unsubscribeToken);
        await transporter.sendMail({
          from: `"Your Business" <${process.env.GMAIL_USER}>`,
          to: sub.email,
          subject: campaign.subject,
          html,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'List-Unsubscribe': `<${(process.env.BACKEND_PUBLIC_URL || process.env.BACKEND_URL || '').replace(/\/$/,'')}/api/subscriptions/unsubscribe/${sub.unsubscribeToken}>`
          }
        });
        sent += 1;
      } catch (e) {
        failed += 1;
      }
      await new Promise(r => setTimeout(r, 150));
    }

    campaign.status = 'sent';
    campaign.sentAt = new Date();
    campaign.stats = { recipients, sent, failed };
    await campaign.save();

    res.status(200).json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

function appendUnsub(content, token) {
  const base = process.env.BACKEND_PUBLIC_URL || process.env.BACKEND_URL || '';
  const link = `${base.replace(/\/$/, '')}/api/subscriptions/unsubscribe/${token || '{token}'}`;
  // Generic footer (tokenized links can be added per-user if needed in future)
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


