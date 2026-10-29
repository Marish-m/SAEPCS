import nodemailer from 'nodemailer';

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    const host = process.env.SMTP_HOST || 'smtp.ethereal.email';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    const isSimulationMode =
      process.env.EMAIL_SIMULATION === 'true' ||
      !user ||
      !pass ||
      user === 'your_email@domain.com' ||
      user.includes('demo') ||
      user.includes('mock') ||
      user.includes('example');

    if (!isSimulationMode) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
          connectionTimeout: 5000,
          greetingTimeout: 5000,
        });
        console.log(`[Email Service] Configured with host: ${host}`);
      } catch (err) {
        console.warn(`[Email Service] Transporter init failed, using simulation: ${err.message}`);
        this.transporter = null;
      }
    } else {
      this.transporter = null;
      console.log(`[Email Service] Operating in Simulation / Test Mode.`);
    }
  }

  /**
   * Sends an email with retry support for temporary failures.
   */
  async sendEmail({ to, subject, html, text, maxRetries = 2 }) {
    const from = process.env.EMAIL_FROM || 'alerts@academic-monitoring.edu';
    let attempts = 0;
    let lastError = null;

    while (attempts <= maxRetries) {
      attempts++;
      try {
        if (!this.transporter) {
          // Fallback simulation mode
          console.log(`\n================= [EMAIL SIMULATED OUTBOX] =================`);
          console.log(`To: ${to}`);
          console.log(`Subject: ${subject}`);
          console.log(`Body:\n${text || html}`);
          console.log(`============================================================\n`);
          return {
            success: true,
            simulated: true,
            status: 'delivered',
            messageId: 'mock-mail-' + Date.now(),
            attempts,
          };
        }

        const info = await this.transporter.sendMail({
          from: `"SAEPCS Academic Alert System" <${from}>`,
          to,
          subject,
          text: text || '',
          html: html || `<p>${text}</p>`,
        });

        console.log(`[Email Service] Email sent to ${to} (MessageId: ${info.messageId})`);
        return {
          success: true,
          status: 'delivered',
          messageId: info.messageId,
          attempts,
        };
      } catch (error) {
        lastError = error;
        console.warn(`[Email Service Attempt ${attempts} Failed] ${to}: ${error.message}`);
        if (attempts <= maxRetries) {
          // Exponential backoff delay (short for tests)
          await new Promise((res) => setTimeout(res, 200 * attempts));
        }
      }
    }

    console.error(`[Email Service Error] Failed to send email to ${to} after ${attempts} attempts:`, lastError?.message);
    return {
      success: false,
      status: 'failed',
      error: lastError?.message || 'Email delivery failed',
      attempts,
    };
  }

  /**
   * Generates and dispatches a dedicated academic warning email
   * containing student name, issue, current attendance/marks, recommended action, and date.
   */
  async sendAcademicWarningEmail({
    to,
    studentName,
    rollNumber = '',
    issue,
    currentMetric,
    recommendedAction,
    date = new Date(),
    isParent = true,
    language = 'en',
    facultyContact = 'Department Academic Mentor (Phone: +91 44 2250 1234 | Email: mentor@saepcs.edu)',
  }) {
    const formattedDate = new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const isTamil = language === 'ta';
    const subjectPrefix = isTamil ? 'கல்வி எச்சரிக்கை அறிவிப்பு' : 'Urgent Academic Notice';
    const subject = `${subjectPrefix}: ${studentName}${rollNumber ? ` (${rollNumber})` : ''} - ${issue}`;

    const plainText = [
      `OFFICIAL ACADEMIC NOTICE - SAEPCS`,
      `Date: ${formattedDate}`,
      `----------------------------------------`,
      `Student Name: ${studentName}`,
      rollNumber ? `Roll Number: ${rollNumber}` : '',
      `Academic Issue: ${issue}`,
      `Current Record / Metric: ${currentMetric}`,
      `Recommended Action: ${recommendedAction}`,
      `Institutional Contact: ${facultyContact}`,
      `----------------------------------------`,
      isParent
        ? isTamil
          ? `அன்பார்ந்த பெற்றோர் / பாதுகாவலரே, உங்கள் குழந்தையின் கல்வி நிலையை சரிபார்த்து துறையை தொடர்பு கொள்ளவும். போர்ட்டலில் உள்நுழைய வேண்டிய அவசியமில்லை.`
          : `Dear Parent / Guardian, please review your ward's standing and contact the faculty at ${facultyContact}. No portal registration or login is required to receive this notice.`
        : `Dear Student, please meet your faculty mentor immediately to address this academic advisory.`,
      `Regards,`,
      `Academic Monitoring & Advisory Cell`,
    ]
      .filter(Boolean)
      .join('\n');

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; color: #f8fafc;">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #312e81 100%); padding: 24px 28px; border-bottom: 1px solid #3730a3;">
          <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">SAEPCS Academic Alert</h2>
          <p style="margin: 4px 0 0 0; color: #c7d2fe; font-size: 13px;">Direct Parent Communication & Student Engagement</p>
        </div>
        
        <div style="padding: 24px 28px;">
          <div style="background-color: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
            <p style="margin: 0; color: #fca5a5; font-size: 13px; font-weight: 600;">
              ${isTamil ? 'அவசர கல்வி அறிவிப்பு' : 'URGENT ACADEMIC NOTICE'}: ${issue}
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
            <tbody>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 10px 0; color: #94a3b8; font-weight: 500; width: 38%;">Student Name:</td>
                <td style="padding: 10px 0; color: #f8fafc; font-weight: 600;">${studentName}</td>
              </tr>
              ${
                rollNumber
                  ? `<tr style="border-bottom: 1px solid #1e293b;">
                      <td style="padding: 10px 0; color: #94a3b8; font-weight: 500;">Roll Number:</td>
                      <td style="padding: 10px 0; color: #cbd5e1; font-family: monospace;">${rollNumber}</td>
                    </tr>`
                  : ''
              }
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 10px 0; color: #94a3b8; font-weight: 500;">Notice Issue:</td>
                <td style="padding: 10px 0; color: #f87171; font-weight: 600;">${issue}</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 10px 0; color: #94a3b8; font-weight: 500;">Current Record:</td>
                <td style="padding: 10px 0; color: #fbbf24; font-weight: 600;">${currentMetric}</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 10px 0; color: #94a3b8; font-weight: 500;">Notice Date:</td>
                <td style="padding: 10px 0; color: #cbd5e1;">${formattedDate}</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 10px 0; color: #94a3b8; font-weight: 500; vertical-align: top;">Recommended Action:</td>
                <td style="padding: 10px 0; color: #38bdf8; font-weight: 500;">${recommendedAction}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #94a3b8; font-weight: 500;">Faculty / Institution Contact:</td>
                <td style="padding: 10px 0; color: #a7f3d0; font-weight: 500;">${facultyContact}</td>
              </tr>
            </tbody>
          </table>

          <div style="background-color: #1e293b; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 12px; color: #cbd5e1; line-height: 1.5;">
              ${
                isParent
                  ? isTamil
                    ? `பெற்றோர்கள் நேரடியாக தொடர்பு கொள்ளலாம்: ${facultyContact}. போர்ட்டலில் பதிவு செய்யவோ அல்லது உள்நுழையவோ தேவையில்லை.`
                    : `Direct communication notice: You may contact the department directly at ${facultyContact}. You do NOT need to register, log in, or install an application to receive alerts.`
                  : `Please consult your assigned faculty advisor during advisory hours to formulate a recovery plan.`
              }
            </p>
          </div>
        </div>

        <div style="background-color: #0b1120; padding: 16px 28px; text-align: center; border-top: 1px solid #1e293b;">
          <p style="margin: 0; font-size: 11px; color: #64748b;">
            This is an automated communication generated by the Student Academic Engagement Monitoring System (SAEPCS).
          </p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to,
      subject,
      text: plainText,
      html: htmlContent,
    });
  }
}

export default new EmailService();
