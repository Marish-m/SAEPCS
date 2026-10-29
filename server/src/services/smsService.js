import '../config/env.js';

/**
 * Provider Abstraction for SMS Gateways (Fast2SMS, Twilio, and Mock Simulator)
 * Fully dynamic environment evaluation without hardcoded mock overrides.
 */
class SMSService {
  /**
   * Safe configuration diagnostics and active provider resolution.
   * Dynamically evaluates process.env on every call.
   */
  getProviderInfo() {
    const configured = (process.env.SMS_PROVIDER || '').trim().toLowerCase();

    const fast2smsKey = (process.env.FAST2SMS_API_KEY || '').trim();
    const hasFast2smsKey = Boolean(
      fast2smsKey &&
      !fast2smsKey.includes('mock') &&
      !fast2smsKey.includes('dummy') &&
      fast2smsKey.length > 10
    );

    const twilioSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
    const twilioToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
    const twilioPhone = (process.env.TWILIO_PHONE_NUMBER || '').trim();
    const hasTwilio = Boolean(
      twilioSid &&
      twilioToken &&
      twilioPhone &&
      !twilioSid.includes('mock') &&
      !twilioSid.includes('dummy')
    );

    // 1. Explicit Fast2SMS Configuration
    if (configured === 'fast2sms') {
      if (hasFast2smsKey) {
        return {
          provider: 'fast2sms',
          configuredProvider: 'fast2sms',
          isMock: false,
          hasApiKey: true,
          statusDescription: 'Fast2SMS active with valid API key. Cellular transmissions route to Fast2SMS API.',
          fallbackReason: null,
        };
      }
      return {
        provider: 'mock',
        configuredProvider: 'fast2sms',
        isMock: true,
        hasApiKey: false,
        statusDescription: 'Fast2SMS selected in server/.env, but FAST2SMS_API_KEY is missing or invalid. Falling back to simulation mode.',
        fallbackReason: 'FAST2SMS_API_KEY missing or placeholder.',
      };
    }

    // 2. Explicit Twilio Configuration
    if (configured === 'twilio') {
      if (hasTwilio) {
        return {
          provider: 'twilio',
          configuredProvider: 'twilio',
          isMock: false,
          hasApiKey: true,
          statusDescription: 'Twilio SMS active with configured credentials.',
          fallbackReason: null,
        };
      }
      return {
        provider: 'mock',
        configuredProvider: 'twilio',
        isMock: true,
        hasApiKey: false,
        statusDescription: 'Twilio selected in server/.env, but TWILIO_ACCOUNT_SID or AUTH_TOKEN is missing. Falling back to simulation mode.',
        fallbackReason: 'Twilio credentials missing or placeholder.',
      };
    }

    // 3. Explicit Mock Configuration
    if (configured === 'mock') {
      return {
        provider: 'mock',
        configuredProvider: 'mock',
        isMock: true,
        hasApiKey: false,
        statusDescription: 'Explicit Development Simulation Mode (SMS_PROVIDER=mock).',
        fallbackReason: null,
      };
    }

    // 4. Auto-detection fallback if SMS_PROVIDER is unspecified
    if (hasFast2smsKey) {
      return {
        provider: 'fast2sms',
        configuredProvider: 'auto-detected (fast2sms)',
        isMock: false,
        hasApiKey: true,
        statusDescription: 'Fast2SMS auto-detected via configured FAST2SMS_API_KEY in server/.env.',
        fallbackReason: null,
      };
    }

    if (hasTwilio) {
      return {
        provider: 'twilio',
        configuredProvider: 'auto-detected (twilio)',
        isMock: false,
        hasApiKey: true,
        statusDescription: 'Twilio SMS auto-detected via configured credentials in server/.env.',
        fallbackReason: null,
      };
    }

    // Default Fallback
    return {
      provider: 'mock',
      configuredProvider: 'none',
      isMock: true,
      hasApiKey: false,
      statusDescription: 'No live SMS credentials found in server/.env. Running in development simulation mode.',
      fallbackReason: 'No provider credentials configured.',
    };
  }

  get provider() {
    return this.getProviderInfo().provider;
  }

  /**
   * Mask phone numbers in server logs for privacy
   */
  maskPhone(phone) {
    if (!phone) return 'unknown';
    const digits = phone.replace(/\s+/g, '');
    if (digits.length <= 4) return '****';
    return digits.slice(0, Math.min(3, digits.length - 4)) + '****' + digits.slice(-4);
  }

  /**
   * Dispatches SMS through configured provider with retry handling and non-breaking error recovery.
   */
  async sendSMS({ to, message, maxRetries = 1 }) {
    if (!to || !to.trim()) {
      return {
        success: false,
        status: 'failed',
        error: 'Recipient phone number is missing or empty',
        attempts: 0,
      };
    }

    const sanitizedPhone = to.trim();
    const providerInfo = this.getProviderInfo();
    let attempts = 0;
    let lastError = null;

    while (attempts <= maxRetries) {
      attempts++;
      try {
        const result = await this._dispatchByProvider(sanitizedPhone, message, providerInfo);
        return {
          ...result,
          attempts,
          sentAt: new Date(),
          deliveredAt: result.status === 'delivered' ? new Date() : null,
        };
      } catch (err) {
        lastError = err;
        console.warn(`[SMS Service Attempt ${attempts} Failed] ${this.maskPhone(sanitizedPhone)}: ${err.message}`);
        if (attempts <= maxRetries) {
          await new Promise((res) => setTimeout(res, 200 * attempts));
        }
      }
    }

    console.error(`[SMS Service Error] Non-breaking failure for ${this.maskPhone(sanitizedPhone)}:`, lastError?.message);
    return {
      success: false,
      status: 'failed',
      provider: providerInfo.provider,
      error: lastError?.message || 'SMS delivery failed',
      attempts,
      sentAt: new Date(),
    };
  }

  /**
   * Internal provider dispatcher
   */
  async _dispatchByProvider(to, message, providerInfo) {
    const info = providerInfo || this.getProviderInfo();
    const activeProvider = info.provider;

    // 1. Fast2SMS Provider (Official Bulk SMS V2 Quick Route)
    if (activeProvider === 'fast2sms') {
      const fast2smsKey = (process.env.FAST2SMS_API_KEY || '').trim();
      const rawDigits = to.replace(/\D/g, '');
      const indNumber = rawDigits.length >= 10 ? rawDigits.slice(-10) : rawDigits;

      if (indNumber.length !== 10) {
        throw new Error(`Invalid Indian mobile number: "${to}". Expected a 10-digit mobile number.`);
      }

      // Check if message contains unicode characters (Tamil, Hindi, special glyphs)
      const isUnicode = /[^\u0000-\u007F]/.test(message);

      console.log(`[Fast2SMS Gateway] Dispatching cellular SMS to recipient ${this.maskPhone(indNumber)} (Language: ${isUnicode ? 'unicode' : 'english'})`);

      const payload = {
        route: 'q',
        message: message,
        language: isUnicode ? 'unicode' : 'english',
        flash: 0,
        numbers: indNumber,
      };

      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: fast2smsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.return === true) {
        const reqId = data.request_id || `F2S_${Date.now()}`;
        console.log(`[Fast2SMS Gateway] Request ACCEPTED by Fast2SMS. Request ID: ${reqId} for ${this.maskPhone(indNumber)}`);
        
        // Per requirement: Never claim delivered merely because the API accepted the request
        return {
          success: true,
          status: 'sent', // Accepted by gateway & queued to carrier network
          deliveryState: 'accepted_by_gateway',
          provider: 'fast2sms',
          messageId: reqId,
          simulated: false,
          gatewayMessage: Array.isArray(data.message) ? data.message.join(', ') : (data.message || 'SMS accepted by Fast2SMS'),
        };
      } else {
        const errDetail = Array.isArray(data.message) ? data.message.join(', ') : (data.message || 'Fast2SMS dispatch rejected');
        throw new Error(`Fast2SMS Error (${data.status_code || response.status}): ${errDetail}`);
      }
    }

    // 2. Twilio Provider
    if (activeProvider === 'twilio') {
      const twilioSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
      const twilioToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
      const twilioPhone = (process.env.TWILIO_PHONE_NUMBER || '').trim();

      const formattedTo = to.startsWith('+') ? to.replace(/\s+/g, '') : `+${to.replace(/[^0-9]/g, '')}`;
      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const params = new URLSearchParams({
        To: formattedTo,
        From: twilioPhone,
        Body: message,
      });

      console.log(`[Twilio SMS Gateway] Submitting message to destination: ${this.maskPhone(formattedTo)}`);
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = await response.json();
      if (response.ok) {
        console.log(`[Twilio SMS Gateway] Request ACCEPTED by Twilio. SID: ${data.sid}`);
        return {
          success: true,
          status: 'sent', // Queued / Sent per Twilio Messages lifecycle
          deliveryState: 'accepted_by_gateway',
          provider: 'twilio',
          messageId: data.sid,
          simulated: false,
        };
      } else {
        throw new Error(data.message || `Twilio SMS rejected with code ${data.code}`);
      }
    }

    // 3. High-fidelity Simulation / Mock Provider (Default for dev & automated testing)
    const simulatedSid = `SIM_SMS_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    console.log(`\n================== [SMS SIMULATED GATEWAY] ==================`);
    console.log(`Active Provider: ${info.provider.toUpperCase()} (Development Simulation Mode)`);
    console.log(`Notice: ${info.statusDescription}`);
    console.log(`Recipient Phone: ${this.maskPhone(to)}`);
    console.log(`Message Content:\n${message}`);
    console.log(`Simulated Message ID: ${simulatedSid}`);
    console.log(`=============================================================\n`);

    return {
      success: true,
      status: 'simulated',
      deliveryState: 'simulated',
      simulated: true,
      provider: 'mock',
      messageId: simulatedSid,
    };
  }

  /**
   * Helper to format a concise SMS alert (< 160 characters)
   */
  formatAcademicWarningSMS({ studentName, issue, currentMetric, recommendedAction, language = 'en' }) {
    if (language === 'ta') {
      const taMsg = `கல்வி எச்சரிக்கை: மாணவர் ${studentName} - ${issue} (${currentMetric}). கல்லூரி ஆசிரியரை தொடர்பு கொள்ளவும். -SAEPCS`;
      return taMsg.length > 160 ? taMsg.slice(0, 157) + '...' : taMsg;
    }
    const actionSnippet = recommendedAction ? ` Action: ${recommendedAction}` : '';
    const sms = `Academic Alert: ${studentName} - ${issue} (${currentMetric}).${actionSnippet} -SAEPCS`;
    return sms.length > 160 ? sms.slice(0, 157) + '...' : sms;
  }

  /**
   * Formats event-specific parent SMS messages in simple and direct language
   */
  formatDirectParentAlert({
    studentName,
    eventType = 'attendance_alert',
    details = '',
    metric = '',
    language = 'en',
  }) {
    const name = studentName || 'your child';
    if (language === 'ta') {
      switch (eventType) {
        case 'frequent_absent':
        case 'absence_alert':
          return `அன்பார்ந்த பெற்றோரே, உங்கள் குழந்தை ${name} இன்று வரவில்லை. கூடுதல் விவரங்களுக்கு கல்லூரியை தொடர்பு கொள்ளவும். -SAEPCS`;
        case 'attendance_alert':
          return `அன்பார்ந்த பெற்றோரே, உங்கள் குழந்தை ${name} வருகை பதிவு குறைந்துள்ளது (${metric || '<75%'}). ஆசிரியரை தொடர்பு கொள்ளவும். -SAEPCS`;
        case 'low_marks_warning':
          return `அன்பார்ந்த பெற்றோரே, உங்கள் குழந்தை ${name} உள்மதிப்பீட்டு மதிப்பெண் குறைந்துள்ளது (${metric || details}). ஆசிரியரை அணுகவும். -SAEPCS`;
        case 'meeting_scheduled':
          return `அன்பார்ந்த பெற்றோரே, உங்கள் குழந்தை ${name} தொடர்பாக ஆசிரியர் சந்திப்பு திட்டமிடப்பட்டுள்ளது: ${details}. -SAEPCS`;
        case 'announcement':
          return `அன்பார்ந்த பெற்றோரே, கல்லூரி முக்கிய அறிவிப்பு: ${details}. -SAEPCS`;
        default:
          return `அன்பார்ந்த பெற்றோரே, உங்கள் குழந்தை ${name} கல்வி முன்னேற்ற அறிவிப்பு: ${details}. -SAEPCS`;
      }
    }

    switch (eventType) {
      case 'frequent_absent':
      case 'absence_alert':
        return `Dear Parent, your child ${name} was absent today. Please contact the college for more information. -SAEPCS`;
      case 'attendance_alert':
        return `Dear Parent, your child ${name} has attendance at ${metric || 'below 75%'}, which is below threshold. Please contact the faculty. -SAEPCS`;
      case 'low_marks_warning':
        return `Dear Parent, your child ${name} has scored below passing marks (${metric || details}). Remedial guidance is recommended. -SAEPCS`;
      case 'meeting_scheduled':
        return `Dear Parent, a faculty meeting has been scheduled regarding your child ${name}: ${details}. Please contact college for details. -SAEPCS`;
      case 'announcement':
        return `Dear Parent, college announcement regarding your child ${name}: ${details}. -SAEPCS`;
      default:
        return `Dear Parent, academic notification regarding ${name}: ${details || metric}. Please contact faculty. -SAEPCS`;
    }
  }
}

export default new SMSService();
