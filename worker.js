// Cloudflare Worker: recibe avisos de descarga y mensajes del formulario de soporte,
// y los reenvía por correo usando la API de Resend (resend.com).
//
// Configuración necesaria en el dashboard de Cloudflare (Workers & Pages > tu worker > Settings > Variables):
//   - RESEND_API_KEY   (secreto): tu API key de Resend
//   - NOTIFY_TO        (variable normal): el correo que debe recibir los avisos, ej. havora.wb@gmail.com
//
// El remitente usa el dominio de pruebas de Resend (onboarding@resend.dev), que no requiere
// verificar un dominio propio y funciona de inmediato en el plan gratuito.

const ALLOWED_ORIGIN = 'https://havorawb.github.io';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function sendEmail(env, subject, text) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Havora <onboarding@resend.dev>',
      to: [env.NOTIFY_TO],
      subject,
      text,
    }),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders() });
    }

    try {
      if (body.type === 'download') {
        await sendEmail(
          env,
          'Nueva descarga de Havora',
          `Alguien hizo clic en el botón de descarga.\n\nPágina: ${body.page || '—'}\nFecha: ${new Date().toISOString()}`
        );
      } else if (body.type === 'suggestion') {
        const name = (body.name || 'Anónimo').slice(0, 200);
        const email = (body.email || 'sin correo').slice(0, 200);
        const message = (body.message || '').slice(0, 5000);
        if (!message.trim()) return new Response('Mensaje vacío', { status: 400, headers: corsHeaders() });
        await sendEmail(
          env,
          `Sugerencia/soporte de ${name}`,
          `De: ${name} <${email}>\n\n${message}`
        );
      } else {
        return new Response('Tipo desconocido', { status: 400, headers: corsHeaders() });
      }
    } catch (err) {
      return new Response(`Error enviando correo: ${err.message}`, { status: 502, headers: corsHeaders() });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  },
};
