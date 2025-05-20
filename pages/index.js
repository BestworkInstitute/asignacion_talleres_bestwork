import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { asignarProfesores } from '../utils/asignador';
import GoogleSheetsWriter from '../components/GoogleSheetsWriter';

export default function Home() {
  const [profesores, setProfesores] = useState([]);
  const [talleresOriginales, setTalleresOriginales] = useState([]);
  const [talleresAsignados, setTalleresAsignados] = useState([]);
  const [fechaLimiteConfirmacion, setFechaLimiteConfirmacion] = useState('');

  useEffect(() => {
    if (profesores.length > 0 && talleresOriginales.length > 0) {
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
      profesorAsignado: null,
    }));

    setTalleresOriginales(parsed);
  };

  const exportToExcel = (data, filename) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([excelBuffer], { type: "application/octet-stream" }), filename);
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
      body: profesores.map(p => [p.nombre, p.bloquesAsignados, p.bloquesDisponibles.join(', ')]),
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Curso', 'ID Bloque', 'Profesor Asignado']],
      body: talleresAsignados.map(t => [t.curso, t.idBloque, t.profesorAsignado || '—']),
    });

    const resumen = {};
    talleresAsignados.forEach(t => {
      if (!t.profesorAsignado) return;
      if (!resumen[t.profesorAsignado]) {
        const prof = profesores.find(p => p.nombre === t.profesorAsignado);
        resumen[t.profesorAsignado] = {
          esperados: prof?.bloquesAsignados || 0,
          asignados: 0,
          bloques: new Set(),
          cursos: new Set()
        };
      }
      resumen[t.profesorAsignado].asignados++;
      resumen[t.profesorAsignado].bloques.add(t.idBloque);
      resumen[t.profesorAsignado].cursos.add(t.curso);
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Profesor', 'Bloques Esperados', 'Asignados', 'Bloques', 'Cursos']],
      body: Object.entries(resumen).map(([n, d]) => [
        n,
        d.esperados,
        d.asignados,
        [...d.bloques].join(', '),
        [...d.cursos].join(', ')
      ]),
    });

    doc.save('informe_asignacion_profesores.pdf');
  };

  const enviarMensajesFlow = async () => {
    if (!fechaLimiteConfirmacion) {
      alert('⚠️ Debes ingresar la fecha límite de confirmación antes de enviar.');
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
        let result = {};
        try {
          result = text ? JSON.parse(text) : {};
        } catch {
          console.warn(`⚠️ La respuesta no es JSON para ${prof.nombre}:`, text);
        }

        console.log(`📲 Mensaje enviado a ${prof.nombre}`, result);
      } catch (err) {
        console.error(`❌ Error al enviar mensaje a ${prof.nombre}`, err);
      }
    }

    alert('✅ Todos los mensajes fueron enviados');
  };

  const renderDisponibilidadFinal = () => {
    const disponibilidadFinal = profesores.map(p => {
      const bloquesAsignados = talleresAsignados
        .filter(t => t.profesorAsignado === p.nombre)
        .map(t => t.idBloque);
      const disponiblesFinal = p.bloquesDisponibles.filter(b => !bloquesAsignados.includes(b));
      return [p.nombre, disponiblesFinal.join(', ')];
    });

    return renderTable(
      'Disponibilidad Final de Profesores',
      ['Profesor', 'Bloques Disponibles Restantes'],
      disponibilidadFinal,
      () => {
        const dataExcel = disponibilidadFinal.map(([nombre, disponibles]) => ({
          Profesor: nombre,
          DisponiblesFinales: disponibles
        }));
        exportToExcel(dataExcel, 'disponibilidad_final.xlsx');
      }
    );
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Segoe UI', background: '#f4f6f8' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <img src="https://bestwork.cl/wp-content/uploads/2023/05/Logo.png" alt="Bestwork" height="80" />
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

      {profesores.length > 0 && renderTable(
        'Disponibilidad de profesores',
        ['Nombre', 'Bloques Asignados', 'Bloques Disponibles'],
        profesores.map(p => [p.nombre, p.bloquesAsignados, p.bloquesDisponibles.join(', ')]),
        () => exportToExcel(profesores, 'profesores.xlsx')
      )}

      {talleresAsignados.length > 0 && renderTable(
        'Talleres con Profesor Asignado',
        ['Bloque', 'Curso', 'Día', 'ID Bloque', 'Profesor Asignado'],
        talleresAsignados.map(t => [t.bloque, t.curso, t.dia, t.idBloque, t.profesorAsignado || '—']),
        () => exportToExcel(talleresAsignados, 'talleres_asignados.xlsx')
      )}

      {talleresAsignados.length > 0 && (
        <GoogleSheetsWriter
          talleresAsignados={talleresAsignados}
          disponibilidadFinal={profesores.map(p => {
            const bloquesAsignados = talleresAsignados
              .filter(t => t.profesorAsignado === p.nombre)
              .map(t => t.idBloque);
            const disponibles = p.bloquesDisponibles.filter(b => !bloquesAsignados.includes(b));
            return [p.nombre, disponibles.join(', ')];
          })}
          profesores={profesores}
        />
      )}

      {talleresAsignados.length > 0 && renderDisponibilidadFinal()}

      {talleresAsignados.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <label><strong>Fecha límite de confirmación:</strong></label><br />
          <input
            type="datetime-local"
            value={fechaLimiteConfirmacion}
            onChange={(e) => setFechaLimiteConfirmacion(e.target.value)}
            style={{
              marginBottom: '1rem',
              padding: '8px',
              borderRadius: '5px',
              border: '1px solid #ccc',
              fontSize: '14px'
            }}
          />
          <br />
          <button onClick={enviarMensajesFlow} style={styles.buttonFlow}>
            🚀 Enviar vía Flow (SMS)
          </button>
        </div>
      )}

      {talleresAsignados.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button onClick={generarInformePDF} style={styles.buttonPDF}>
            📄 Descargar Informe PDF
          </button>
        </div>
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
  buttonExport: {
    backgroundColor: '#007bff',
    color: '#fff',
    padding: '8px 16px',
    border: 'none',
    borderRadius: '5px',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '0.5rem'
  },
  buttonPDF: {
    backgroundColor: '#6c63ff',
    color: '#fff',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
  },
  buttonFlow: {
    backgroundColor: '#28a745',
    color: '#fff',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
  }
};

function renderTable(title, headers, rows, onDownload) {
  return (
    <section style={{ marginTop: '2rem' }}>
      <h2>{title}</h2>
      <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
        <thead style={{ background: '#d6e4f0' }}>
          <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => <td key={ci}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: '1rem' }}>
        <button style={styles.buttonExport} onClick={onDownload}>⬇️ Descargar</button>
      </div>
    </section>
  );
}
