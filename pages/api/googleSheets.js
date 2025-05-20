import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = '178Bzvl7PUwHMr8xgCJ8o5ma25f3UGN49JBkYDKkJ6UM';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { talleresAsignados, disponibilidadFinal, profesores } = req.body;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: SCOPES,
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // LIMPIAR Y ENVIAR HOJA PRINCIPAL
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: 'TALLERES ASIGNADOS PROFESORES!A:D',
    });

    const talleresValues = [
      ['Bloque', 'Curso', 'Día', 'ID Bloque', 'Profesor Asignado'],
      ...talleresAsignados.map(t => [
        t.bloque,
        t.curso,
        t.dia,
        t.idBloque,
        t.profesorAsignado || '—'
      ]),
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'TALLERES ASIGNADOS PROFESORES!A1',
      valueInputOption: 'RAW',
      requestBody: { values: talleresValues },
    });

    // AGREGAR AL HISTÓRICO
    const fechaHora = new Date().toLocaleString('es-CL');
    const historicoValues = talleresAsignados.map(t => {
      const prof = profesores.find(p => p.nombre === t.profesorAsignado);
      return [
        fechaHora,
        t.bloque,
        t.curso,
        t.dia,
        t.idBloque,
        t.profesorAsignado || '',
        prof?.clave || '',
        '' // RESPUESTA PROFESOR vacía por ahora
      ];
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'TALLERES ASIGNADOS PROFESORES HISTORICO!A1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: historicoValues },
    });

    // CONTADOR
    const conAsignados = profesores.filter(p =>
      talleresAsignados.some(t => t.profesorAsignado === p.nombre)
    ).length;

    const sinAsignar = profesores.length - conAsignados;

    // ENVIAR FLOW API
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + 2); // fecha límite 48h después
    const fechaTexto = fechaLimite.toLocaleDateString('es-CL');

    for (const prof of profesores) {
      const tieneAsignacion = talleresAsignados.some(t => t.profesorAsignado === prof.nombre);
      if (!tieneAsignacion) continue;

      await fetch('https://flows.messagebird.com/flows/82e2f21a-a273-491e-bead-450b6c94c473/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          NOMBREPROFESOR: prof.nombre,
          TELEFONOPROFESOR: prof.celular || '',
          LINK: 'https://bestwork.cl/asignaciones',
          FECHA: fechaTexto,
        })
      });
    }

    res.status(200).json({
      status: 'OK',
      uploaded: {
        talleres: talleresValues.length - 1,
        historico: historicoValues.length,
        profesoresConAsignacion: conAsignados,
        profesoresSinAsignacion: sinAsignar
      }
    });
  } catch (err) {
    console.error('❌ Error Google Sheets API:', err);
    res.status(500).json({ error: 'Google Sheets API failed', message: err.message });
  }
}
