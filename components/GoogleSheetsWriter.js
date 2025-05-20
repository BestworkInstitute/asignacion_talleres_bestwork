import { useEffect } from 'react';

export default function GoogleSheetsWriter({ talleresAsignados, disponibilidadFinal, profesores }) {
  useEffect(() => {
    const uploadToSheets = async () => {
      try {
        const response = await fetch('/api/googleSheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ talleresAsignados, disponibilidadFinal, profesores }),
        });

        const result = await response.json();
        console.log('✅ Google Sheets actualizado:', result);
      } catch (err) {
        console.error('❌ Error al subir a Google Sheets:', err);
      }
    };

    uploadToSheets();
  }, [talleresAsignados, disponibilidadFinal, profesores]);

  return null;
}
