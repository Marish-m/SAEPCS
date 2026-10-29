/**
 * Voice-Friendly Notification Service for Accessibility
 *
 * Designed specifically for parents who cannot read or have limited digital literacy.
 *
 * Capabilities:
 * 1. Multi-lingual spoken audio generation (English, Tamil, and Hindi).
 * 2. Automated outbound phone calls via Twilio Voice API when configured.
 * 3. Transparent development simulation mode when credentials are absent (no false claims).
 * 4. Browser Text-To-Speech (SpeechSynthesis) audition tools for faculty.
 * 5. Parental consent and telecom opt-out enforcement.
 * 6. Configurable retry policies for unsuccessful calls.
 */
class VoiceService {
  constructor() {
    this.provider = (process.env.VOICE_PROVIDER || 'browser_tts').toLowerCase();
    this.isCallEnabled = process.env.TWILIO_VOICE_CALL_ENABLED === 'true';
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  }

  /**
   * Generates short, simple, spoken notifications in English, Tamil, and Hindi.
   */
  generateVoiceMessages({ studentName, issueType = 'attendance_alert', metricValue = '', details = '' }) {
    const name = studentName || 'your child';
    const metricStr = metricValue ? ` at ${metricValue}` : '';

    switch (issueType) {
      case 'attendance_alert':
        return {
          en: `Hello. This is an academic notification from your child's college. Your child ${name} has low attendance${metricStr}. Please contact the faculty member to discuss attendance improvement. Thank you.`,
          ta: `வணக்கம். இது உங்கள் குழந்தையின் கல்லூரியிலிருந்து வரும் கல்வி அறிவிப்பு. உங்கள் குழந்தை ${name} வருகை பதிவு குறைவாக உள்ளது. வருகையை மேம்படுத்த வகுப்பு ஆசிரியரை தொடர்பு கொள்ளவும். நன்றி.`,
          ta_transliterated: `Vanakkam. This is an academic alert from college. Your child ${name} has low attendance${metricStr}. Please contact the class faculty to discuss attendance improvement. Thank you.`,
          hi: `नमस्ते। यह आपके बच्चे के कॉलेज से एक शैक्षणिक सूचना है। आपके बच्चे ${name} की उपस्थिति कम है। कृपया उपस्थिति में सुधार के लिए शिक्षक से संपर्क करें। धन्यवाद।`,
        };

      case 'frequent_absent':
      case 'absence_alert':
        return {
          en: `Hello. This is an academic notification from your child's college. Your child ${name} was absent today. Please contact the college for more information. Thank you.`,
          ta: `வணக்கம். இது உங்கள் குழந்தையின் கல்லூரியிலிருந்து வரும் கல்வி அறிவிப்பு. உங்கள் குழந்தை ${name} இன்று கல்லூரிக்கு வரவில்லை. விவரங்களுக்கு கல்லூரியை தொடர்பு கொள்ளவும். நன்றி.`,
          ta_transliterated: `Vanakkam. Your child ${name} was absent today. Please contact the college for more information. Thank you.`,
          hi: `नमस्ते। यह आपके बच्चे के कॉलेज से सूचना है। आपका बच्चा ${name} आज अनुपस्थित था। अधिक जानकारी के लिए कृपया कॉलेज से संपर्क करें। धन्यवाद।`,
        };

      case 'low_marks_warning':
        return {
          en: `Hello. This is an academic notification from your child's college. Your child ${name} has internal assessment marks${metricStr} below the passing benchmark. Remedial faculty guidance is recommended. Thank you.`,
          ta: `வணக்கம். இது உங்கள் குழந்தையின் கல்லூரியிலிருந்து வரும் கல்வி அறிவிப்பு. உங்கள் குழந்தை ${name} உள்மதிப்பீட்டு மதிப்பெண் குறைவாக உள்ளது. கூடுதல் வழிகாட்டலுக்கு வகுப்பு ஆசிரியரை அணுகவும். நன்றி.`,
          ta_transliterated: `Vanakkam. Your child ${name} has internal marks below the passing benchmark. Please consult the department faculty. Thank you.`,
          hi: `नमस्ते। आपके बच्चे ${name} के आंतरिक अंक कम हैं। कृपया उपचारात्मक मार्गदर्शन के लिए शिक्षक से मिलें। धन्यवाद।`,
        };

      case 'assignment_overdue':
        return {
          en: `Hello. Your child ${name} has assignments overdue and unsubmitted past the deadline. Please ensure timely submission. Thank you.`,
          ta: `வணக்கம். உங்கள் குழந்தை ${name} பணிகளை சமர்ப்பிக்காமல் நிலுவையில் வைத்துள்ளார். உடனே சமர்ப்பிக்க அறிவுறுத்தவும். நன்றி.`,
          ta_transliterated: `Vanakkam. Your child ${name} has missing assignments past the deadline. Please ensure they submit them immediately. Thank you.`,
          hi: `नमस्ते। आपके बच्चे ${name} के असाइनमेंट जमा नहीं हुए हैं। कृपया समय पर जमा करवाएं। धन्यवाद।`,
        };

      case 'excessive_leave':
        return {
          en: `Hello. Your child ${name} has accumulated excessive days of leave reaching the institutional limit. Please contact the faculty mentor. Thank you.`,
          ta: `வணக்கம். உங்கள் குழந்தை ${name} அனுமதிக்கப்பட்ட அதிகபட்ச விடுமுறையை எட்டியுள்ளார். வகுப்பு ஆசிரியரை தொடர்பு கொள்ளவும். நன்றி.`,
          ta_transliterated: `Vanakkam. Your child ${name} has taken excessive leaves reaching the institutional quota. Please contact the faculty. Thank you.`,
          hi: `नमस्ते। आपके बच्चे ${name} ने अधिकतम स्वीकृत छुट्टी ले ली है। कृपया शिक्षक से संपर्क करें। धन्यवाद।`,
        };

      case 'meeting_scheduled':
        return {
          en: `Hello. This is an academic notification from your child's college. A meeting with faculty has been scheduled regarding your child ${name}. ${details || 'Please contact the college for timing details.'} Thank you.`,
          ta: `வணக்கம். உங்கள் குழந்தை ${name} தொடர்பாக ஆசிரியர் சந்திப்பு திட்டமிடப்பட்டுள்ளது. ${details || 'விவரங்களுக்கு கல்லூரியை தொடர்பு கொள்ளவும்.'} நன்றி.`,
          ta_transliterated: `Vanakkam. A faculty meeting has been scheduled regarding your child ${name}. ${details || 'Please contact the college.'} Thank you.`,
          hi: `नमस्ते। आपके बच्चे ${name} के लिए शिक्षक बैठक निर्धारित की गई है। ${details || 'कृपया कॉलेज से संपर्क करें।'} धन्यवाद।`,
        };

      case 'announcement':
      case 'faculty_message':
        return {
          en: `Hello. This is an academic communication from your child's college regarding ${name}. ${details || 'An important academic update has been issued.'} Thank you.`,
          ta: `வணக்கம். உங்கள் குழந்தை ${name} குறித்து கல்லூரியின் முக்கிய தகவல்: ${details || 'கல்வி ஆலோசனை வெளியிடப்பட்டுள்ளது.'} நன்றி.`,
          ta_transliterated: `Vanakkam. Academic communication regarding ${name}: ${details || 'Important college notice.'} Thank you.`,
          hi: `नमस्ते। आपके बच्चे ${name} के संबंध में कॉलेज से महत्वपूर्ण संदेश: ${details || 'शैक्षणिक सूचना जारी की गई है।'} धन्यवाद।`,
        };

      case 'test_notification':
        return {
          en: `Hello. This is a test notification from your child's college to verify direct parent communication. Thank you.`,
          ta: `வணக்கம். இது நேரடி பெற்றோர் தொடர்பை சரிபார்க்க உங்கள் குழந்தையின் கல்லூரியிலிருந்து அனுப்பப்பட்ட சோதனை அழைப்பு ஆகும். நன்றி.`,
          ta_transliterated: `Vanakkam. This is a test voice notification from your child's college to verify direct parent communication. Thank you.`,
          hi: `नमस्ते। यह सीधे अभिभावक संपर्क का परीक्षण करने के लिए आपके बच्चे के कॉलेज से एक संदेश है। धन्यवाद।`,
        };

      case 'academic_risk':
      default:
        return {
          en: `Hello. This is an academic notification from your child's college. Your child ${name} has an academic alert${metricStr}. Please contact the class faculty for further details. Thank you.`,
          ta: `வணக்கம். உங்கள் குழந்தை ${name} கல்வி முன்னேற்றத்தில் கவனம் தேவை. விவரங்களுக்கு வகுப்பு ஆசிரியரை அணுகவும். நன்றி.`,
          ta_transliterated: `Vanakkam. Academic advisory for your child ${name}. Please contact the class faculty. Thank you.`,
          hi: `नमस्ते। आपके बच्चे ${name} के शैक्षणिक प्रदर्शन पर ध्यान देने की आवश्यकता है। कृपया शिक्षक से संपर्क करें। धन्यवाद।`,
        };
    }
  }

  /**
   * Returns current voice dispatch configuration & capabilities
   */
  getVoiceCapabilities() {
    const isCallEnabled = process.env.TWILIO_VOICE_CALL_ENABLED === 'true';
    const accountSid = process.env.TWILIO_ACCOUNT_SID || this.accountSid;
    const authToken = process.env.TWILIO_AUTH_TOKEN || this.authToken;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER || this.phoneNumber;

    const isTwilioConfigured = Boolean(
      isCallEnabled &&
        accountSid &&
        authToken &&
        phoneNumber &&
        !accountSid.includes('mock') &&
        !accountSid.includes('dummy')
    );

    return {
      browserTTS: {
        supported: true,
        supportedLanguages: [
          { code: 'en', label: 'English', voiceHint: 'en-IN / en-US' },
          { code: 'ta', label: 'தமிழ் (Tamil)', voiceHint: 'ta-IN / Tamil' },
          { code: 'hi', label: 'हिंदी (Hindi)', voiceHint: 'hi-IN / Hindi' },
        ],
        sampleTamilGreeting: 'Vanakkam. This is an academic alert from college. Your child has low attendance. Please contact the class faculty.',
      },
      automatedPhoneCalls: {
        configured: isTwilioConfigured,
        provider: isTwilioConfigured ? 'twilio_voice' : 'simulation',
        consentMandatory: true,
        simulationMode: !isTwilioConfigured,
        callerIdConfigured: this.phoneNumber || 'Not Configured',
        statusNotice: isTwilioConfigured
          ? 'Automated programmable voice call gateway is active via Twilio Voice.'
          : 'Automated voice calls are currently operating in Development Simulation Mode (Twilio Voice credentials not provided). No real phone call will be placed, and simulations are clearly marked.',
      },
    };
  }

  /**
   * Generates standard TwiML XML string for speech synthesis
   */
  generateTwiML({ message, language = 'en' }) {
    let langCode = 'en-IN';
    let voice = 'Polly.Aditi';

    if (language === 'ta') {
      langCode = 'ta-IN';
      voice = 'Polly.Aditi';
    } else if (language === 'hi') {
      langCode = 'hi-IN';
      voice = 'Polly.Aditi';
    }

    // Escape XML special characters
    const safeText = (message || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Say language="${langCode}" voice="${voice}">${safeText}</Say>
  <Pause length="1"/>
  <Say language="${langCode}" voice="${voice}">${safeText}</Say>
  <Pause length="1"/>
  <Say language="${langCode}" voice="${voice}">Thank you. Goodbye.</Say>
</Response>`;
  }

  /**
   * Places an outbound automated call to the parent's phone number.
   * If real Twilio credentials are configured, calls the Twilio Voice REST API.
   * Otherwise, executes transparent simulation without falsely claiming a call was placed.
   */
  async placeOutboundCall({
    toPhone,
    studentName,
    issueType = 'attendance_alert',
    metricValue = '',
    details = '',
    languagePreference = 'en',
    consentVerified = true,
    maxRetries = 1,
  }) {
    if (!toPhone || !toPhone.trim()) {
      return {
        success: false,
        status: 'failed',
        error: 'Parent phone number is required for voice notification',
        attempts: 0,
      };
    }

    if (!consentVerified) {
      return {
        success: false,
        status: 'skipped',
        error: 'Parent consent unverified or opted out. Voice call withheld in compliance with telecom regulations.',
        attempts: 0,
      };
    }

    const messages = this.generateVoiceMessages({ studentName, issueType, metricValue, details });
    let spokenText = messages.en;
    if (languagePreference === 'ta') {
      spokenText = messages.ta;
    } else if (languagePreference === 'hi') {
      spokenText = messages.hi;
    }

    const sanitizedPhone = toPhone.trim();
    const isCallEnabled = process.env.TWILIO_VOICE_CALL_ENABLED === 'true';
    const accountSid = process.env.TWILIO_ACCOUNT_SID || this.accountSid;
    const authToken = process.env.TWILIO_AUTH_TOKEN || this.authToken;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER || this.phoneNumber;

    const isTwilioConfigured = Boolean(
      isCallEnabled &&
        accountSid &&
        authToken &&
        phoneNumber &&
        !accountSid.includes('mock') &&
        !accountSid.includes('dummy')
    );

    let attempts = 0;
    let lastError = null;

    // Real Outbound Call via Twilio Voice API
    if (isTwilioConfigured) {
      while (attempts <= maxRetries) {
        attempts++;
        try {
          console.log(`[Twilio Voice Attempt ${attempts}] Initiating outbound call to ${sanitizedPhone}...`);
          const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
          const twiml = this.generateTwiML({ message: spokenText, language: languagePreference });

          const params = new URLSearchParams({
            To: sanitizedPhone,
            From: this.phoneNumber,
            Twiml: twiml,
          });

          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls.json`;
          const response = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          });

          const data = await response.json();

          if (response.ok && data.sid) {
            console.log(`[Twilio Voice Success] Call SID: ${data.sid} initiated to ${sanitizedPhone}`);
            return {
              success: true,
              mode: 'automated_call',
              status: 'delivered',
              provider: 'twilio_voice',
              callSid: data.sid,
              transcript: spokenText,
              language: languagePreference,
              consentVerified: true,
              simulated: false,
              attempts,
              sentAt: new Date(),
              deliveredAt: new Date(),
            };
          } else {
            throw new Error(data.message || 'Twilio Voice API call rejected');
          }
        } catch (err) {
          lastError = err;
          console.warn(`[Twilio Voice Call Failed] ${sanitizedPhone}: ${err.message}`);
          if (attempts <= maxRetries) {
            await new Promise((res) => setTimeout(res, 500 * attempts));
          }
        }
      }

      return {
        success: false,
        mode: 'automated_call',
        status: 'failed',
        provider: 'twilio_voice',
        error: lastError?.message || 'Voice call failed',
        transcript: spokenText,
        language: languagePreference,
        consentVerified: true,
        simulated: false,
        attempts,
        sentAt: new Date(),
      };
    }

    // High-Fidelity Simulation Mode (Default for Dev & Testing when Twilio Voice credentials not set)
    const simulatedCallSid = `SIM_CALL_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    console.log(`\n================= [VOICE CALL SIMULATION GATEWAY] =================`);
    console.log(`Provider: TWILIO VOICE (Development Simulation Mode)`);
    console.log(`Recipient Phone: ${sanitizedPhone}`);
    console.log(`Spoken Language: ${languagePreference.toUpperCase()}`);
    console.log(`Spoken Notification Content:\n"${spokenText}"`);
    console.log(`Simulated Call SID: ${simulatedCallSid}`);
    console.log(`Notice: Simulated call generated. External Twilio credentials not configured.`);
    console.log(`===================================================================\n`);

    return {
      success: true,
      mode: 'automated_call',
      status: 'simulated',
      provider: 'twilio_voice_simulation',
      callSid: simulatedCallSid,
      transcript: spokenText,
      language: languagePreference,
      consentVerified: true,
      simulated: true,
      attempts: 1,
      sentAt: new Date(),
      deliveredAt: new Date(),
    };
  }

  /**
   * Prepares or dispatches a voice notification record.
   * Backward-compatible with previous tests while enabling outbound calling.
   */
  async prepareVoiceNotification({
    toPhone,
    studentName,
    issueType,
    metricValue,
    languagePreference = 'en',
    consentVerified = false,
    makeCall = false,
  }) {
    const messages = this.generateVoiceMessages({ studentName, issueType, metricValue });
    const chosenTranscript = languagePreference === 'ta' ? messages.ta_transliterated : messages.en;

    // If caller explicitly requested placing an automated outbound call:
    if (makeCall && toPhone) {
      return await this.placeOutboundCall({
        toPhone,
        studentName,
        issueType,
        metricValue,
        languagePreference,
        consentVerified,
      });
    }

    // Standard Browser TTS Record (Never claims a phone call was placed)
    return {
      mode: 'browser_tts',
      status: 'ready',
      provider: 'browser_speech_synthesis',
      callSid: '',
      transcript: chosenTranscript,
      language: languagePreference,
      consentVerified,
      simulated: false,
    };
  }
}

export default new VoiceService();
