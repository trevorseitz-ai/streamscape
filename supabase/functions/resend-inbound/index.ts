import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// Define allowed social alias addresses to automatically filter spam
const ALLOWED_SOCIAL_ALIASES = [
  'x@getreeldive.com',
  'linkedin@getreeldive.com',
  'threads@getreeldive.com',
  'youtube@getreeldive.com'
];

Deno.serve(async (req) => {
  try {
    // 1. Parse the incoming JSON webhook notification payload from Resend
    const payload = await req.json();

    if (payload.type !== 'email.received') {
      return new Response(JSON.stringify({ status: 'ignored_event_type' }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { email_id, from } = payload.data;
    const recipients: string[] = payload.data.to || [];

    // 2. Validate if the email was directed at a target social profile alias
    const targetAlias = recipients.find(email => ALLOWED_SOCIAL_ALIASES.includes(email.toLowerCase()));

    if (!targetAlias) {
      console.log(`🗑️ Ignored email to unmonitored alias: ${recipients.join(', ')}`);
      return new Response(JSON.stringify({ status: 'ignored_unrecognized_alias' }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log(`📩 Fetching content for: ${targetAlias} from sender: ${from}`);

    // 3. Make a secure fetch query back to Resend to scrape the email text
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    const resendResponse = await fetch(`https://api.resend.com/emails/receiving/${email_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!resendResponse.ok) {
      console.error('❌ Failed to fetch raw mail body data from Resend API');
      return new Response(JSON.stringify({ error: 'Upstream fetching failure' }), { status: 500 });
    }

    const emailContent = await resendResponse.json();
    const emailBodyText = emailContent.text || '';
    const emailSubject = emailContent.subject || '';

    // 4. Extract standard 6-digit confirmation security PIN configurations
    const pinMatch = emailBodyText.match(/\b\d{6}\b/) || emailSubject.match(/\b\d{6}\b/);

    if (pinMatch) {
      const verificationPin = pinMatch[0];
      console.log(`🎯 Found Registration PIN for ${targetAlias}: [ ${verificationPin} ]`);
      
      // TODO: Connect this directly to your database orchestrator or agent system logs
      // e.g., await savePinToAgentQueue(targetAlias, verificationPin);
    } else {
      console.log(`ℹ️ Email parsed successfully, but no standard 6-digit code structure was identified.`);
    }

    return new Response(JSON.stringify({ processed: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('💥 Critical script runtime execution failure:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
})