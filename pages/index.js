import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import RenderTable from '../components/RenderTable';
import enviarAGoogleSheets from '../components/GoogleSheetsWriter';
import { asignarProfesores } from '../utils/asignador';
import Image from 'next/image';

export default function Home() {
  const [profesores, setProfesores] = useState([]);
  const [talleresOriginales, setTalleresOriginales] = useState([]);
  const [talleresAsignados, setTalleresAsignados] = useState([]);
  const [fechaLimiteConfirmacion, setFechaLimiteConfirmacion] = useState('');
  const [mensajeEnviado, setMensajeEnviado] = useState(false);

  useEffect(() => {
    if (profesores.length && talleresOriginales.length) {
      const asignados = asignarProfesores(profesores, talleresOriginales);
      setTalleresAsignados(asignados);
    }
  }, [profesores, talleresOriginales]);

  const leerArchivoProfesores = async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return alert('Archivo de profesores no válido');

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }).slice(1);

    const parsed = rows.map(r => ({
      nombre: r[0],
      bloquesDisponibles: typeof r[1] === 'string' ? r[1].split(', ') : [],
      bloquesAsignados: parseFloat(r[2]) || 0,
      categoria: r[3],
      correo: typeof r[4] === 'string' ? r[4].trim() : '',
      clave: typeof r[5] === 'string' ? r[5].trim() : '',
      ponderacion: r[6],
      celular: r[7] ? String(r[7]).trim() : '',
      asignados: 0,
    }));

    setProfesores(parsed);
  };

  const leerArchivoBloques = async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return alert('Archivo de talleres no válido');

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }).slice(1);

    const parsed = rows.map(r => ({
      bloque: r[0],
      curso: r[1],
      dia: r[2],
      idBloque: r[3],
      cuenta: r[4] || '',
      profesorAsignado: null,
    }));

    setTalleresOriginales(parsed);
  };

  const exportToExcel = (data, filename) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), filename);
  };

  const generarInformePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Bestwork - Asignación de Talleres', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generado el ${new Date().toLocaleDateString('es-CL')}`, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [['Nombre', 'Bloques Asignados', 'Bloques Disponibles']],
      body: profesores.map(p => [p.nombre, p.bloquesAsignados, p.bloquesDisponibles.join(', ')])
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Curso', 'ID Bloque', 'Cuenta', 'Profesor Asignado']],
      body: talleresAsignados.map(t => [t.curso, t.idBloque, t.cuenta || '', t.profesorAsignado || '—'])
    });

    doc.save('informe_asignacion_profesores.pdf');
  };

  const disponibilidadFinal = profesores.map(p => {
    const bloquesAsignados = talleresAsignados.filter(t => t.profesorAsignado === p.nombre).map(t => t.idBloque);
    const disponiblesFinal = p.bloquesDisponibles.filter(b => !bloquesAsignados.includes(b));
    return [p.nombre, disponiblesFinal.join(', ')];
  });

  const enviarMensajesFlow = async () => {
    if (!fechaLimiteConfirmacion) {
      alert('⚠️ Debes ingresar la fecha límite de confirmación.');
      return;
    }

    const fechaTexto = new Date(fechaLimiteConfirmacion).toLocaleString('es-CL');

    const profesoresConAsignacion = profesores.filter(p =>
      talleresAsignados.some(t => t.profesorAsignado === p.nombre)
    );

    for (const prof of profesoresConAsignacion) {
      if (!prof.celular || prof.celular.length < 8) {
        console.warn(`⚠️ Profesor sin celular válido: ${prof.nombre}`);
        continue;
      }

      const celularFormateado = prof.celular.startsWith('56')
        ? prof.celular
        : '56' + prof.celular.replace(/^0/, '').replace(/\s+/g, '');

      const payload = {
        NOMBREPROFESOR: prof.nombre,
        TELEFONOPROFESOR: celularFormateado,
        FECHA: fechaTexto
      };

      try {
        const response = await fetch(
          'https://flows.messagebird.com/flows/4fecefd6-1c98-4195-8cff-1fbfcee3e0bb/invoke',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );

        const text = await response.text();
        console.log(`📲 Mensaje enviado a ${prof.nombre}`, text);
      } catch (error) {
        console.error('❌ Error al enviar mensaje:', error);
        alert('🚨 Error de conexión');
      }
    }

    // Subida a Google Sheets luego del envío
    try {
      await enviarAGoogleSheets({ talleresAsignados, disponibilidadFinal, profesores });
      alert('✅ Mensajes enviados y datos subidos a Google Sheets');
      setMensajeEnviado(true);
    } catch (error) {
      alert('🚨 Error de conexión con Google Sheets');
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Segoe UI', background: '#f4f6f8' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Image
          src="https://bestwork.cl/wp-content/uploads/2023/05/Logo.png"
          alt="Bestwork"
          width={160}
          height={80}
        />
      </div>

      <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>Asignación de Talleres</h1>

      <section>
        <label><strong>Subir Profesores (.xlsx o .csv):</strong></label><br />
        <input type="file" accept=".xlsx,.csv" onChange={leerArchivoProfesores} style={styles.upload} />
      </section>

      <section style={{ marginTop: '2rem' }}>
        <label><strong>Subir Talleres (.xlsx o .csv):</strong></label><br />
        <input type="file" accept=".xlsx,.csv" onChange={leerArchivoBloques} style={styles.upload} />
      </section>

      {profesores.length > 0 && (
        <RenderTable
          title="Disponibilidad de Profesores"
          headers={['Nombre', 'Bloques Asignados', 'Bloques Disponibles']}
          rows={profesores.map(p => [p.nombre, p.bloquesAsignados, p.bloquesDisponibles.join(', ')])}
          onDownload={() => exportToExcel(profesores, 'profesores.xlsx')}
        />
      )}

      {talleresAsignados.length > 0 && (
        <RenderTable
          title="Talleres con Profesor Asignado"
          headers={['Bloque', 'Curso', 'Día', 'ID Bloque', 'Cuenta', 'Profesor Asignado']}
          rows={talleresAsignados.map(t => [t.bloque, t.curso, t.dia, t.idBloque, t.cuenta || '', t.profesorAsignado || '—'])}
          onDownload={() => exportToExcel(talleresAsignados, 'talleres_asignados.xlsx')}
        />
      )}

      {talleresAsignados.length > 0 && (
        <RenderTable
          title="Disponibilidad Final de Profesores"
          headers={['Profesor', 'Bloques Disponibles Restantes']}
          rows={disponibilidadFinal}
          onDownload={() =>
            exportToExcel(
              disponibilidadFinal.map(([nombre, disponibles]) => ({
                Profesor: nombre,
                DisponiblesFinales: disponibles
              })),
              'disponibilidad_final.xlsx'
            )
          }
        />
      )}

      {talleresAsignados.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <label><strong>Fecha límite de confirmación:</strong></label><br />
          <input
            type="datetime-local"
            value={fechaLimiteConfirmacion}
            onChange={(e) => setFechaLimiteConfirmacion(e.target.value)}
            style={styles.input}
          />
          <br />
          <button onClick={enviarMensajesFlow} style={styles.buttonFlow}>
            🚀 Enviar vía Flow (SMS) y subir a Google Sheets
          </button>
        </div>
      )}

      {mensajeEnviado && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button onClick={generarInformePDF} style={styles.buttonPDF}>
            📄 Descargar Informe PDF
          </button>
        </div>
      )}

      {profesores.length > 0 && talleresAsignados.length > 0 && (
        <section style={{ marginTop: '3rem', padding: '1rem', background: '#fffbe6', borderRadius: '8px' }}>
          <h2>📊 Métricas de Asignación</h2>
          <p><strong>Profesores con al menos un taller asignado:</strong> {
            profesores.filter(p => talleresAsignados.some(t => t.profesorAsignado === p.nombre)).length
          }</p>
          <p><strong>Profesores sin talleres asignados:</strong> {
            profesores.filter(p => !talleresAsignados.some(t => t.profesorAsignado === p.nombre)).length
          }</p>

          <table border="1" cellPadding="8" style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#ffe08a' }}>
              <tr>
                <th>Profesor</th>
                <th>Talleres Esperados</th>
                <th>Talleres Asignados</th>
              </tr>
            </thead>
            <tbody>
              {profesores.map(p => {
                const asignados = talleresAsignados.filter(t => t.profesorAsignado === p.nombre).length;
                return (
                  <tr key={p.nombre}>
                    <td>{p.nombre}</td>
                    <td>{p.bloquesAsignados}</td>
                    <td>{asignados}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

const styles = {
  upload: {
    padding: '10px',
    borderRadius: '5px',
    border: '1px solid #ccc',
    marginBottom: '1rem',
    marginTop: '0.5rem',
  },
  input: {
    marginBottom: '1rem',
    padding: '8px',
    borderRadius: '5px',
    border: '1px solid #ccc',
    fontSize: '14px'
  },
  buttonFlow: {
    backgroundColor: '#28a745',
    color: '#fff',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
  },
  buttonPDF: {
    backgroundColor: '#6c63ff',
    color: '#fff',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
  }
};
