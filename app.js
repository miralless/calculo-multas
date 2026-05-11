import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, getDocs, addDoc, serverTimestamp, 
    deleteDoc, doc, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    setDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- CONFIGURACIÓN ---
const firebaseConfig = {
    apiKey: "AIzaSyBXpADHBqN2g6cFx_DgGayonfTLzZWNHhc",
    authDomain: "calculo-multas.firebaseapp.com",
    projectId: "calculo-multas",
    storageBucket: "calculo-multas.firebasestorage.app",
    messagingSenderId: "125421516230",
    appId: "1:125421516230:web:9d7fda95d17a948227eec7",
    measurementId: "G-HJE22TKDDZ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- REFERENCIAS DOM ---
const selectJugador = document.getElementById('select-jugador');
const selectRegla = document.getElementById('select-regla');
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const mainHeader = document.getElementById('main-header');

const linkRegistrar = document.getElementById('link-registrar');
const linkHistorial = document.getElementById('link-historial');
const linkTotales = document.getElementById('link-totales');

const viewRegistrar = document.getElementById('app-section'); 
const viewHistorial = document.getElementById('view-historial');
const viewTotales = document.getElementById('view-totales');

let miGrafica = null;

// --- GESTIÓN DE VISTAS ---
function mostrarVista(vistaActiva) {
    [viewRegistrar, viewHistorial, viewTotales].forEach(v => v.style.display = 'none');
    vistaActiva.style.display = 'block';
    [linkRegistrar, linkHistorial, linkTotales].forEach(l => l.classList.remove('active'));
}

// --- AUTENTICACIÓN ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginSection.style.display = 'none';
        appSection.style.display = 'block';
        mainHeader.style.display = 'block';
        cargarDatos(); 
    } else {
        loginSection.style.display = 'block';
        appSection.style.display = 'none';
        mainHeader.style.display = 'none';
    }
});

document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        document.getElementById('login-error').innerText = "Datos incorrectos";
    }
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// --- CARGA DE SELECTORES ---
async function cargarDatos() {
    try {
        const [jugSnap, regSnap] = await Promise.all([
            getDocs(collection(db, "Jugadores")),
            getDocs(collection(db, "Reglamento"))
        ]);
        selectJugador.innerHTML = '<option value=""></option>';
        jugSnap.forEach(d => selectJugador.innerHTML += `<option value="${d.id}">${d.data().nombre}</option>`);
        selectRegla.innerHTML = '<option value=""></option>';
        regSnap.forEach(d => selectRegla.innerHTML += `<option value="${d.id}">${d.data().infraccion} (${d.data().importe}€)</option>`);
    } catch (e) { console.error(e); }
}

// --- REGISTRAR MULTA ---
document.getElementById('btn-multar').addEventListener('click', async () => {
    const jugadorId = selectJugador.value;
    const reglaId = selectRegla.value;

    if (!jugadorId || !reglaId) {
        return Swal.fire({
            icon: 'warning',
            title: 'Atención',
            text: 'Selecciona jugador y regla',
            confirmButtonColor: '#28a745'
        });
    }

    try {
        const jugSnap = await getDocs(collection(db, "Jugadores"));
        const regSnap = await getDocs(collection(db, "Reglamento"));
        let jNom = "", rNom = "", imp = 0;
        jugSnap.forEach(d => { if(d.id === jugadorId) jNom = d.data().nombre; });
        regSnap.forEach(d => { if(d.id === reglaId) { rNom = d.data().infraccion; imp = d.data().importe; } });

        await addDoc(collection(db, "Multas"), {
            jugadorNombre: jNom,
            reglaNombre: rNom,
            importe: Number(imp),
            fecha: serverTimestamp()
        });

        Swal.fire({
            icon: 'success',
            title: '¡Hecho!',
            text: 'Multa registrada correctamente',
            padding: '0 0px 20px 0px',
            timer: 2000,
            width: '85%',
            showConfirmButton: false
        });

        selectJugador.value = ""; 
        selectRegla.value = "";
    } catch (e) { 
        console.error(e); 
        Swal.fire({
            title: 'Error',
            text: 'No se pudo registrar la multa',
            icon: 'error',
            width: '85%'
        });
    }
});

// --- HISTORIAL ---
async function cargarHistorial() {
    const contenedor = document.getElementById('lista-multas'); 
    contenedor.innerHTML = "Cargando...";
    try {
        const q = query(collection(db, "Multas"), orderBy("fecha", "desc"));
        const snap = await getDocs(q);
        contenedor.innerHTML = snap.empty ? "<p style='color: black; text-align: center; background-color: white; border-radius: 5px; padding: 10px; width: 95%; margin: auto;'>No hay multas.</p>" : "";
        snap.forEach((docu) => {
            const d = docu.data();
            const fecha = d.fecha ? d.fecha.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "S/F";
            contenedor.innerHTML += `
                <div class="multa-item" style="border: 1px solid #ddd; padding: 10px; margin-bottom: 8px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div><strong>${d.jugadorNombre}</strong><br><small>${d.reglaNombre} - ${fecha}</small></div>
                    <div style="display: flex; flex-direction: row; align-items: center; gap: 10px;">
                        <strong style="padding-top: 6px;">${d.importe}€</strong>
                        <button onclick="eliminarMulta('${docu.id}')" style="background: #ff4d4d; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>`;
        });
    } catch (e) { console.error(e); }
}

window.eliminarMulta = async (id) => {
    const result = await Swal.fire({
        title: '¿Eliminar multa?',
        text: "Esta multa será eliminada",
        icon: 'warning',
        width: '85%',
        showCancelButton: true,
        confirmButtonColor: '#ff4d4d',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, "Multas", id));
            Swal.fire({
                title: 'Eliminado',
                text: 'La multa ha sido borrada',
                icon: 'success',
                width: '85%'
            });
            cargarHistorial();
        } catch (e) {
            Swal.fire({
                title: 'Error',
                text: 'No se pudo eliminar',
                icon: 'error',
                width: '85%'
            });
        }
    }
};

function inicializarSelector() {
    const selector = document.getElementById('selectorMes');
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();

    const temporada = [
        { m: 7, a: 2025 }, { m: 8, a: 2025 }, { m: 9, a: 2025 }, { m: 10, a: 2025 }, { m: 11, a: 2025 },
        { m: 0, a: 2026 }, { m: 1, a: 2026 }, { m: 2, a: 2026 }, { m: 3, a: 2026 }, { m: 4, a: 2026 }
    ];

    selector.innerHTML = "";
    temporada.forEach(item => {
        // Solo añadir si el mes ya llegó o pasó
        if (item.a < añoActual || (item.a === añoActual && item.m <= mesActual)) {
            let opt = document.createElement('option');
            opt.value = `${item.m}-${item.a}`;
            opt.innerHTML = `${meses[item.m]} ${item.a}`;
            if (item.m === mesActual && item.a === añoActual) opt.selected = true;
            selector.appendChild(opt);
        }
    });
}

// --- TOTALES Y GRÁFICA ADAPTADA ---
async function cargarTotales() {
    const contenedor = document.getElementById('lista-totales');
    const selector = document.getElementById('selectorMes');
    const canvasElement = document.getElementById('graficaMultas');
    const displayTotalGeneral = document.getElementById('suma-total-general');

    if (selector.options.length === 0) inicializarSelector();
    
    const [mesFiltro, añoFiltro] = selector.value.split('-').map(Number);
    contenedor.innerHTML = "Calculando deudas...";

    try {
        // 1. Cargamos Jugadores, Multas y Pagos en paralelo
        const [jugSnap, multasSnap, pagosSnap] = await Promise.all([
            getDocs(collection(db, "Jugadores")),
            getDocs(collection(db, "Multas")),
            getDocs(collection(db, "Pagos"))
        ]);

        const deudasTotales = {};
        const pagadoEsteMes = {};
        let acumuladorTotalMes = 0;

        // 2. Inicializamos a TODOS los jugadores con 0€
        jugSnap.forEach(docJug => {
            const nombre = docJug.data().nombre;
            deudasTotales[nombre] = 0;
        });

        // 3. Sumamos las multas (arrastre histórico)
        multasSnap.forEach((d) => {
            const data = d.data();
            const f = data.fecha ? data.fecha.toDate() : new Date();
            const m = f.getMonth();
            const a = f.getFullYear();

            if (a === añoFiltro && m === mesFiltro) { // Solo lo de este mes para el total general
                if (deudasTotales.hasOwnProperty(data.jugadorNombre)) {
                    deudasTotales[data.jugadorNombre] += data.importe;
                    acumuladorTotalMes += data.importe; // SUMAMOS AL TOTAL GENERAL
                }
            }
        });

        displayTotalGeneral.innerText = `${acumuladorTotalMes}€`;

        // 4. Marcamos quién ha pagado este mes
        pagosSnap.forEach(d => {
            const [pNombre, pMes, pAño] = d.id.split('_');
            if (parseInt(pMes) === mesFiltro && parseInt(pAño) === añoFiltro) {
                pagadoEsteMes[pNombre] = true;
            }
        });

        contenedor.innerHTML = "";
        const nombres = Object.keys(deudasTotales).sort(); // Ordenamos alfabéticamente

        if (nombres.length === 0) {
            contenedor.innerHTML = `<div style="width:100%; text-align:center; background:white; padding:20px; border-radius:10px;">No hay jugadores registrados.</div>`;
            if (miGrafica) miGrafica.destroy();
            canvasElement.style.display = "none";
            return;
        }

        canvasElement.style.display = "block";
        nombres.forEach(n => {
            const estaPagado = pagadoEsteMes[n];
            contenedor.innerHTML += `
                <div onclick="confirmarPago('${n}', ${mesFiltro}, ${añoFiltro}, ${estaPagado})" 
                     class="total-item" 
                     style="display: flex; 
                            flex-direction: row; 
                            justify-content: space-between; 
                            align-items: center; 
                            padding: 12px 15px; 
                            background-color: ${estaPagado ? '#eaffef' : '#ffffff'}; 
                            border-radius: 10px; 
                            margin-bottom: 8px; 
                            cursor: pointer; 
                            border: 1px solid ${estaPagado ? '#28a745' : '#eeeeee'};
                            width: 100%; 
                            box-sizing: border-box;">
                    
                    <span style="font-size: 15px; color: #333; font-weight: 500;">
                        ${estaPagado ? '<i class="fa-solid fa-check-circle" style="color: #28a745; margin-right: 5px;"></i>' : ''}${n}
                    </span>
                    
                    <span style="font-size: 15px; font-weight: bold; color: ${estaPagado ? '#218838' : '#333333'}; background: transparent;">
                        ${estaPagado ? 'PAGADO' : deudasTotales[n] + '€'}
                    </span>
                </div>`;
        });

        // Ajuste de altura dinámica para que no se estire
        const esMovil = window.innerWidth < 600;
        const pixelesPorBarra = esMovil ? 35 : 30;
        const nuevaAltura = Math.max(400, nombres.length * pixelesPorBarra);

        // 2. IMPORTANTE: Forzar la altura físicamente antes de renderizar
        canvasElement.style.height = nuevaAltura + 'px';
        canvasElement.height = nuevaAltura; 

        // 3. Renderizar
        renderizarGrafica(deudasTotales, pagadoEsteMes, esMovil);
    } catch (e) { console.error(e); }
}

window.confirmarPago = async (nombre, mes, año, yaPagado) => {
    const idPago = `${nombre}_${mes}_${año}`;
    
    const result = await Swal.fire({
        title: yaPagado ? '¿Anular pago?' : '¿Marcar como pagado?',
        text: yaPagado ? `El mes de ${nombre} volverá a aparecer como pendiente.` : `Se registrará que ${nombre} ha pagado este mes.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: yaPagado ? '#ff4d4d' : '#28a745',
        confirmButtonText: yaPagado ? 'Sí, anular' : 'Sí, ha pagado'
    });

    if (result.isConfirmed) {
        try {
            if (yaPagado) {
                await deleteDoc(doc(db, "Pagos", idPago));
            } else {
                await setDoc(doc(db, "Pagos", idPago), {
                    jugador: nombre,
                    mes: mes,
                    año: año,
                    fechaPago: serverTimestamp()
                });
            }
            cargarTotales();
        } catch (e) { console.error(e); }
    }
};

function renderizarGrafica(datos, pagados, esMovil) {
    const ctx = document.getElementById('graficaMultas').getContext('2d');
    if (miGrafica) miGrafica.destroy();

    const labels = Object.keys(datos);
    const valores = Object.values(datos);
    
    // Si tiene 0€ y no está pagado, podemos usar un gris suave o el rojo habitual
    const backgroundColors = labels.map(n => {
        if (pagados[n]) return 'rgba(40, 167, 69, 0.8)'; // Verde si pagó
        if (datos[n] === 0) return 'rgba(200, 200, 200, 0.5)'; // Gris si tiene 0€
        return 'rgba(255, 99, 132, 0.7)'; // Rojo si debe algo
    });

    const borderColors = labels.map(n => {
        if (pagados[n]) return '#28a745';
        if (datos[n] === 0) return '#cccccc';
        return '#ff4d4d';
    });

    miGrafica = new Chart(ctx, {
        type: 'bar', 
        data: {
            labels: labels,
            datasets: [{
                data: valores,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 2,
                borderRadius: 5,
                categoryPercentage: 0.9,
                barPercentage: 0.8,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 50,
            animation: {
                duration: 0 // Desactiva animaciones para probar si esto detiene el bucle
            },
            layout: { padding: { left: 0, right: 35, top: 10, bottom: 10 } },
            plugins: { legend: { display: false } },
            scales: { 
                x: { beginAtZero: true, ticks: { callback: v => v + '€', font: { size: 10 } } },
                y: { 
                    afterFit: (s) => s.width = esMovil ? 75 : 95,
                    ticks: { 
                        color: '#333333', 
                        font: { family: "Arial", size: 15, weight: 'normal' },
                        padding: 5,
                        crossAlign: 'far',
                        callback: function(v) {
                            const lbl = this.getLabelForValue(v);
                            return lbl.length > 12 ? lbl.substring(0, 11) + '..' : lbl;
                        }
                    },
                    grid: { display: false, drawBorder: false }
                }
            }
        }
    });
}

document.getElementById('btn-exportar').addEventListener('click', async () => {
    const selector = document.getElementById('selectorMes');
    const [mesFiltro, añoFiltro] = selector.value.split('-').map(Number);
    const nombreMes = selector.options[selector.selectedIndex].text;

    try {
        // 1. Obtener datos necesarios
        const [jugSnap, regSnap, multasSnap] = await Promise.all([
            getDocs(collection(db, "Jugadores")),
            getDocs(collection(db, "Reglamento")),
            getDocs(collection(db, "Multas"))
        ]);

        const jugadores = [];
        jugSnap.forEach(d => jugadores.push(d.data().nombre));
        jugadores.sort();

        const infracciones = [];
        regSnap.forEach(d => infracciones.push(d.data().infraccion));
        infracciones.sort();

        // 2. Crear la estructura de la matriz: { "Pepe": { "Tardanza": 5, "Falta": 0 }, ... }
        const matriz = {};
        jugadores.forEach(j => {
            matriz[j] = {};
            infracciones.forEach(i => matriz[j][i] = 0);
        });

        // 3. Rellenar con las multas del mes seleccionado
        multasSnap.forEach(d => {
            const data = d.data();
            const f = data.fecha ? data.fecha.toDate() : null;
            if (f && f.getMonth() === mesFiltro && f.getFullYear() === añoFiltro) {
                if (matriz[data.jugadorNombre] && matriz[data.jugadorNombre].hasOwnProperty(data.reglaNombre)) {
                    matriz[data.jugadorNombre][data.reglaNombre] += data.importe;
                }
            }
        });

        // 4. Transformar matriz a formato que entiende SheetJS (Array de Arrays)
        const filasExcel = [ ["JUGADOR", ...infracciones.map(i => i.toUpperCase()), "TOTAL", "JUGADOR"] ];

        jugadores.forEach(j => {
            let totalPersona = 0;
            const fila = [j]; // Primera columna: Nombre
            
            infracciones.forEach(i => {
                const valor = matriz[j][i];
                fila.push(valor === 0 ? "" : valor); 
                totalPersona += valor;
            });
            
            fila.push(totalPersona); // Penúltima columna: Total
            fila.push(j);            // ÚLTIMA COLUMNA: Nombre del jugador otra vez
            
            filasExcel.push(fila);
        });

        // 5. Crear la hoja
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(filasExcel);

        const range = XLSX.utils.decode_range(ws['!ref']);

        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });
                if (!ws[cell_ref]) continue;

                // Estilos base
                ws[cell_ref].s = {
                    alignment: { wrapText: true, vertical: "center", horizontal: "center" },
                    font: { name: "Arial", sz: 10 },
                    border: {
                        top: { style: "thin", color: { rgb: "000000" } },
                        bottom: { style: "thin", color: { rgb: "000000" } },
                        left: { style: "thin", color: { rgb: "000000" } },
                        right: { style: "thin", color: { rgb: "000000" } }
                    }
                };

                const esPrimeraColumna = (C === 0);
                const esUltimaColumna = (C === range.e.c);
                const esColumnaTotal = (C === range.e.c - 1);

                // --- COLORES Y ESTILOS ---
                if (R === 0) {
                    // 1. Fila de Encabezados (Rojo para todos)
                    ws[cell_ref].s.fill = { fgColor: { rgb: "EA4335" } }; 
                    ws[cell_ref].s.font = { color: { rgb: "FFFFFF" }, bold: true };
                } else if (esPrimeraColumna || esColumnaTotal || esUltimaColumna) {
                    // 2. Columnas "Especiales" (Gris claro)
                    // Esto aplica a: Primera (Nombre), Penúltima (Total) y Última (Nombre de nuevo)
                    ws[cell_ref].s.fill = { fgColor: { rgb: "E9ECEF" } }; 
                    ws[cell_ref].s.font = { bold: true };
                    
                    // Ajuste de alineación según la columna para que quede más limpio
                    if (esPrimeraColumna) {
                        ws[cell_ref].s.alignment.horizontal = "left";
                    } else {
                        ws[cell_ref].s.alignment.horizontal = "right";
                    }
                } else {
                    // 3. Celdas de datos (las multas en blanco)
                    ws[cell_ref].s.alignment.horizontal = "center";
                }
            }
        }

        // 6. AUTO FIT (Cálculo de ancho según el texto más largo)
        ws['!cols'] = filasExcel[0].map((_, i) => {
            // Buscamos el texto más largo en cada columna
            const maxChars = filasExcel.reduce((max, fila) => {
                const len = fila[i] ? fila[i].toString().length : 0;
                return len > max ? len : max;
            }, 10);
            return { wch: maxChars + 5 }; // +5 de margen
        });

        // 7. Descargar
        XLSX.utils.book_append_sheet(wb, ws, "Resumen Multas");
        XLSX.writeFile(wb, `Multas_${nombreMes.replace(" ", "_")}.xlsx`);

    } catch (error) {
        console.error("Error al exportar:", error);
        Swal.fire("Error", "No se pudo generar el Excel", "error");
    }
});

// --- NAVEGACIÓN ---
linkRegistrar.addEventListener('click', () => { mostrarVista(viewRegistrar); linkRegistrar.classList.add('active'); });
linkHistorial.addEventListener('click', () => { mostrarVista(viewHistorial); linkHistorial.classList.add('active'); cargarHistorial(); });
linkTotales.addEventListener('click', () => { mostrarVista(viewTotales); linkTotales.classList.add('active'); cargarTotales(); });
document.getElementById('selectorMes').addEventListener('change', cargarTotales);