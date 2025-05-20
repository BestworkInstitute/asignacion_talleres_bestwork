import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = '178Bzvl7PUwHMr8xgCJ8o5ma25f3UGN49JBkYDKkJ6UM';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { talleresAsignados, profesores } = req.body; // 🔥 FIX: sin disponibilidadFinal

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // 🔐 FIX: safe optional chaining
    },
    scopes: SCOPES,
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // Limpiar hoja
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

    // Histórico
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
        ''
      ];
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'TALLERES ASIGNADOS PROFESORES HISTORICO!A1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: historicoValues },
    });

    res.status(200).json({
      status: 'OK',
      uploaded: {
        talleres: talleresValues.length - 1,
        historico: historicoValues.length
      }
    });
  } catch (err) {
    console.error('❌ Error Google Sheets API:', err);
    res.status(500).json({ error: 'Google Sheets API failed', message: err.message });
  }
}
