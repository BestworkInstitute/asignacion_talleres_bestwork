// /components/RenderTable.js
export default function RenderTable({ title, headers, rows, onDownload }) {
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

const styles = {
  buttonExport: {
    backgroundColor: '#007bff',
    color: '#fff',
    padding: '8px 16px',
    border: 'none',
    borderRadius: '5px',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '0.5rem'
  }
};
