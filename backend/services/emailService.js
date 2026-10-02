const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sends a task reminder email via Resend. Optional/secondary notification
 * channel - the primary channel is in-app + voice via TTS.
 */
async function sendTaskReminderEmail(toEmail, farmerName, tasks) {
  if (!toEmail) return { sent: false, reason: 'No email on file for this farmer.' };

  const taskListHtml = tasks
    .map((t) => `<li><strong>${t.title}</strong> - due ${new Date(t.dueDate).toDateString()}</li>`)
    .join('');

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: toEmail,
      subject: 'FarmMitra AI - Your Paddy Crop Tasks',
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Hello ${farmerName},</h2>
          <p>Here are your pending paddy crop tasks:</p>
          <ul>${taskListHtml}</ul>
          <p style="color:#666;font-size:12px;">Sent by FarmMitra AI - Your Voice-Based Farming Companion</p>
        </div>
      `,
    });
    return { sent: true, result };
  } catch (err) {
    console.error('Resend email error:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendTaskReminderEmail };
