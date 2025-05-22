// /components/GoogleSheetsWriter.js
export default async function enviarAGoogleSheets({ talleresAsignados, disponibilidadFinal, profesores }) {
  try {
    const response = await fetch('/api/googleSheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ talleresAsignados, disponibilidadFinal, profesores }),
    });

    const result = await response.json();
    console.log('✅ Google Sheets actualizado:', result);
    return result;
  } catch (err) {
    console.error('❌ Error al subir a Google Sheets:', err);
    throw err;
  }
}
