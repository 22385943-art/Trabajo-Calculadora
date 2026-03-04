// MEMORIA DE LA APP
let state = {
    columns: [],
    rows: []
};

// Capturamos elementos
const inputArchivo = document.getElementById('archivoCsv');
const visor = document.getElementById('contenedorTabla');
const selectorX = document.getElementById('selectX');
const selectorY = document.getElementById('selectY');
const botonCalcular = document.getElementById('btnCalcular');
const areaResultado = document.getElementById('resultadoTexto');

// Nuevos elementos para la API
const inputUrlApi = document.getElementById('inputUrlApi');
const btnCargarApi = document.getElementById('btnCargarApi');

// --- EVENTOS DE CARGA ---

// Carga por CSV
inputArchivo.addEventListener('change', async function() {
    const archivo = inputArchivo.files[0];
    if (!archivo) return;

    const formData = new FormData();
    formData.append('file', archivo);

    const respuesta = await fetch('/api/upload-csv', {
        method: 'POST',
        body: formData
    });

    procesarDatosRecibidos(await respuesta.json());
});

// Carga por API
btnCargarApi.addEventListener('click', async function() {
    const url = inputUrlApi.value.trim();
    if (!url) return alert("Introduce una URL");

    areaResultado.innerHTML = "Consultando API externa...";

    const respuesta = await fetch('/api/load-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
    });

    const datos = await respuesta.json();
    
    if (datos.error) {
        areaResultado.innerHTML = "Error: " + datos.error;
    } else {
        procesarDatosRecibidos(datos);
        areaResultado.innerHTML = "Datos de API cargados.";
    }
});

// Función auxiliar para no repetir código de actualización
function procesarDatosRecibidos(datos) {
    state.columns = datos.columns;
    state.rows = datos.rows;
    dibujarTabla(state.columns, state.rows);
    actualizarSelectores(state.columns);
}

// --- LOGICA DE REGRESIÓN ---

botonCalcular.addEventListener('click', async function() {
    if (state.columns.length === 0) return alert("Carga datos primero");

    const configuracion = {
        columns: state.columns,
        rows: state.rows,
        xCol: selectorX.value,
        yCol: selectorY.value
    };

    const respuesta = await fetch('/api/regression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configuracion)
    });

    const resultado = await respuesta.json();

    areaResultado.innerHTML = `
        <h3>Resultados del Análisis:</h3>
        <p>Ecuación: Y = ${resultado.coefficients.intercept.toFixed(4)} + (${resultado.coefficients.slope.toFixed(4)} * X)</p>
        <p>Coeficiente R²: ${resultado.metrics.r2.toFixed(4)}</p>
        <p>Error Estándar: ${resultado.metrics.standardError.toFixed(4)}</p>
    `;
    dibujarGrafico(selectorX.value, selectorY.value, resultado);
});

// --- FUNCIONES DE APOYO ---

function actualizarSelectores(columnas) {
    selectorX.innerHTML = "";
    selectorY.innerHTML = "";
    columnas.forEach(col => {
        const optX = document.createElement('option');
        optX.value = col; optX.textContent = col;
        selectorX.appendChild(optX);

        const optY = document.createElement('option');
        optY.value = col; optY.textContent = col;
        selectorY.appendChild(optY);
    });
}

function dibujarTabla(columnas, filas) {
    let html = '<table border="1" style="margin-top:10px; border-collapse: collapse; width: 100%;">';
    html += '<tr style="background-color: #eee;">' + columnas.map(c => `<th>${c}</th>`).join('') + '</tr>';
    filas.slice(0, 5).forEach(fila => {
        html += '<tr>' + fila.map(celda => `<td>${celda}</td>`).join('') + '</tr>';
    });
    html += '</table><p><small>Viendo las primeras 5 filas...</small></p>';
    visor.innerHTML = html; 
}

function dibujarGrafico(xCol, yCol, resultado) {
    const xi = state.columns.indexOf(xCol);
    const yi = state.columns.indexOf(yCol);

    const x = state.rows.map(f => Number(f[xi])).filter(n => !isNaN(n));
    const y = state.rows.map(f => Number(f[yi])).filter(n => !isNaN(n));

    const puntos = { x, y, mode: 'markers', type: 'scatter', name: 'Datos' };

    const minX = Math.min(...x);
    const maxX = Math.max(...x);
    
    const linea = {
        x: [minX, maxX],
        y: [
            resultado.coefficients.intercept + resultado.coefficients.slope * minX,
            resultado.coefficients.intercept + resultado.coefficients.slope * maxX
        ],
        mode: 'lines', name: 'Regresión', line: { color: 'red' }
    };

    Plotly.newPlot('graficoRegresion', [puntos, linea], { title: `Regresión: ${yCol} vs ${xCol}` });
}