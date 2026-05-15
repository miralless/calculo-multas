import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, getDocs, addDoc, serverTimestamp, 
    deleteDoc, doc, query, orderBy, setDoc, getDoc, where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
let tomSelectInstance = null; // Variable global para controlar el selector

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

// --- CARGA DE SELECTORES (JUGADORES Y REGLAS) ---
async function cargarDatos() {
    try {
        const [jugSnap, regSnap] = await Promise.all([
            getDocs(collection(db, "Jugadores")),
            getDocs(collection(db, "Reglamento"))
        ]);

        // 1. Configurar Selector de Jugadores (Multi-select con TomSelect)
        const selectMulti = document.getElementById('select-jugadores-multi');
        
        // Guardamos los nombres para pasárselos a TomSelect
        const opcionesJugadores = [];
        jugSnap.forEach(d => {
            opcionesJugadores.push({
                value: d.data().nombre,
                text: d.data().nombre
            });
        });

        // Inicializar o actualizar Tom Select
        if (!tomSelectInstance) {
            tomSelectInstance = new TomSelect("#select-jugadores-multi", {
                plugins: ['remove_button'],
                hideSelected: true,
                options: opcionesJugadores,
                create: false,
                persist: false,
                maxOptions: null, // Para que salgan todos en la búsqueda
                onItemAdd: function() {
                    this.setTextboxValue(''); // Borra el texto escrito en el buscador
                    this.refreshOptions();    // Refresca la lista para mostrar todos de nuevo
                }
            });
        } else {
            tomSelectInstance.clear();
            tomSelectInstance.clearOptions();
            tomSelectInstance.addOptions(opcionesJugadores);
        }

        // 2. Cargar Selector de Reglas
        regSnap.forEach(d => {
            selectRegla.innerHTML += `<option value="${d.id}">${d.data().infraccion} (${d.data().importe}€)</option>`;
        });

    } catch (e) { 
        console.error("Error cargando datos:", e); 
    }
}

// --- REGISTRAR MULTA ---
document.getElementById('btn-multar').addEventListener('click', async () => {
    const idRegla = document.getElementById('select-regla').value;
    
    // Obtenemos los nombres seleccionados directamente de TomSelect
    const nombresSeleccionados = tomSelectInstance.getValue(); // Es un array de strings: ["Pepe", "Juan"]

    if (nombresSeleccionados.length === 0 || !idRegla) {
        Swal.fire({
            icon: 'warning',
            title: 'Atención',
            text: 'Selecciona al menos un jugador y una regla',
            width: '300px'
        });
        return;
    }

    try {
        const reglaDoc = await getDoc(doc(db, "Reglamento", idRegla));
        if (!reglaDoc.exists()) throw new Error("La regla no existe.");
        
        const reglaData = reglaDoc.data();

        // Crear promesas para cada nombre en el array
        const promesas = nombresSeleccionados.map(nombre => {
            return addDoc(collection(db, "Multas"), {
                jugadorNombre: nombre,
                reglaId: idRegla,
                reglaNombre: reglaData.infraccion,
                importe: reglaData.importe,
                fecha: new Date()
            });
        });

        await Promise.all(promesas);

        Swal.fire({
            title: "¡Registrado!",
            text: `${nombresSeleccionados.length > 1 ? `Multa de ${reglaData.importe}€ aplicada a ${nombresSeleccionados.length} jugadores.` : `Multa de ${reglaData.importe}€ aplicada a ${nombresSeleccionados[0]}.`}`,
            icon: "success",
            timer: 2000,
            showConfirmButton: false,
            width: '300px'
        });

        // Limpieza: resetear selectores
        tomSelectInstance.clear(); 
        document.getElementById('select-regla').value = "";

    } catch (error) {
        console.error("Error al registrar multas:", error);
        Swal.fire({
            title: 'Error',
            text: 'No se pudo registrar la multa',
            icon: 'error',
            width: '300px'
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
        contenedor.innerHTML = snap.empty ? "<p class='no-data'>No hay multas.</p>" : "";
        snap.forEach((docu) => {
            const d = docu.data();
            const fecha = d.fecha ? d.fecha.toDate().toLocaleDateString('es-ES') : "S/F";
            contenedor.innerHTML += `
                <div class="multa-item" style="background-color: white; border-radius: 8px; margin-bottom: 10px;">
                    <div><strong>${d.jugadorNombre}</strong><br><small>${d.reglaNombre} - ${fecha}</small></div>
                    <div class="multa-actions">
                        <strong>${d.importe}€</strong>
                        <button onclick="eliminarMulta('${docu.id}')" class="btn-del">
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
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4d4d',
        confirmButtonText: 'Sí, eliminar',
        width: '300px'
    });

    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, "Multas", id));
            cargarHistorial();
            Swal.fire({
                title: 'Eliminado',
                text: 'La multa ha sido borrada',
                icon: 'success',
                width: '300px'
            });
        } catch (e) { console.error(e); }
    }
};

// --- TOTALES, PAGOS Y GRÁFICA ---
function inicializarSelector() {
    const selector = document.getElementById('selectorMes');
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const hoy = new Date();
    const temporada = [
        { m: 7, a: 2025 }, { m: 8, a: 2025 }, { m: 9, a: 2025 }, { m: 10, a: 2025 }, { m: 11, a: 2025 },
        { m: 0, a: 2026 }, { m: 1, a: 2026 }, { m: 2, a: 2026 }, { m: 3, a: 2026 }, { m: 4, a: 2026 }
    ];

    selector.innerHTML = "";
    temporada.forEach(item => {
        if (item.a < hoy.getFullYear() || (item.a === hoy.getFullYear() && item.m <= hoy.getMonth())) {
            let opt = document.createElement('option');
            opt.value = `${item.m}-${item.a}`;
            opt.innerHTML = `${meses[item.m]} ${item.a}`;
            if (item.m === hoy.getMonth() && item.a === hoy.getFullYear()) opt.selected = true;
            selector.appendChild(opt);
        }
    });
}

window.confirmarPago = async (nombre, mes, año, deudaPendiente) => {
    // Si ya no debe nada, no hace falta pagar más (opcional)
    if (deudaPendiente <= 0) {
        const reset = await Swal.fire({
            title: 'Saldo al día',
            text: `¿Deseas resetear los pagos de ${nombre} en este mes?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, resetear deuda',
            width: '300px' // Manteniendo tu ajuste de diseño
        });

        if (reset.isConfirmed) {
            try {
                // Buscamos todos los documentos en la colección "Pagos" que coincidan con el jugador y la fecha
                const q = query(
                    collection(db, "Pagos"), 
                    where("jugador", "==", nombre),
                    where("mes", "==", mes),
                    where("año", "==", año)
                );
                
                const snap = await getDocs(q);
                
                // Usamos un bucle para borrar cada pago encontrado
                const promesasBorrado = [];
                snap.forEach((documento) => {
                    promesasBorrado.push(deleteDoc(doc(db, "Pagos", documento.id)));
                });

                await Promise.all(promesasBorrado);

                await Swal.fire({
                    title: "Reseteado",
                    text: "Se han eliminado todos los pagos del mes.",
                    icon: "success",
                    timer: 1500,
                    showConfirmButton: false,
                    width: '300px'
                });
                
                cargarTotales(); // Recargamos para que vuelva a salir la deuda original
            } catch (e) {
                console.error("Error al resetear:", e);
                Swal.fire("Error", "No se pudieron borrar los pagos", "error");
            }
        }
        return;
    }

    const { value: cantidad } = await Swal.fire({
        title: `Pago de ${nombre}`,
        text: `Deuda pendiente: ${deudaPendiente}€`,
        input: 'number',
        inputLabel: 'Cantidad entregada',
        inputValue: deudaPendiente,
        showCancelButton: true,
        width: '300px',
        inputValidator: (value) => {
            if (!value || value <= 0) return 'Debes poner una cantidad válida';
        }
    });

    if (cantidad) {
        try {
            // Guardamos un registro del pago con un ID único (no basado solo en mes/año para permitir varios abonos)
            await addDoc(collection(db, "Pagos"), {
                jugador: nombre,
                mes: mes,
                año: año,
                importe: parseFloat(cantidad),
                fechaPago: serverTimestamp()
            });
            cargarTotales();
        } catch (e) { console.error(e); }
    }
};

async function cargarTotales() {
    const contenedor = document.getElementById('lista-totales');
    const selector = document.getElementById('selectorMes');
    const sumaTotalElemento = document.getElementById('suma-total-general');

    if (selector.options.length === 0) inicializarSelector();
    
    const [mesFiltro, añoFiltro] = selector.value.split('-').map(Number);
    const fechaCorte = new Date(añoFiltro, mesFiltro + 1, 0, 23, 59, 59);

    contenedor.innerHTML = "Calculando deudas...";

    try {
        const [jugSnap, multasSnap, pagosSnap] = await Promise.all([
            getDocs(collection(db, "Jugadores")),
            getDocs(collection(db, "Multas")),
            getDocs(collection(db, "Pagos"))
        ]);

        const deudasTotales = {}; 
        const deudasMesActual = {}; // <--- NUEVA: Para guardar solo lo de este mes
        const pagosTotales = {};  
        let totalSoloEsteMes = 0;

        jugSnap.forEach(docJug => {
            const n = docJug.data().nombre;
            deudasTotales[n] = 0;
            deudasMesActual[n] = 0; // Inicializar
            pagosTotales[n] = 0;
        });

        // 1. Procesar multas
        multasSnap.forEach(d => {
            const data = d.data();
            const f = data.fecha ? data.fecha.toDate() : new Date();
            const nombreJ = data.jugadorNombre;
            
            if (deudasTotales.hasOwnProperty(nombreJ)) {
                // SUMA PARA EL MARCADOR SUPERIOR Y LISTA VISUAL (Solo este mes)
                if (f.getMonth() === mesFiltro && f.getFullYear() === añoFiltro) {
                    const importe = parseFloat(data.importe || 0);
                    totalSoloEsteMes += importe;
                    deudasMesActual[nombreJ] += importe; // Acumular solo mes actual
                }

                // SUMA PARA EL SALDO REAL (Histórico hasta hoy para saber si debe dinero)
                if (f <= fechaCorte) {
                    deudasTotales[nombreJ] += parseFloat(data.importe || 0);
                }
            }
        });

        // 2. Sumar pagos
        pagosSnap.forEach(d => {
            const data = d.data();
            if (deudasTotales.hasOwnProperty(data.jugador)) {
                if (data.año < añoFiltro || (data.año === añoFiltro && data.mes <= mesFiltro)) {
                    pagosTotales[data.jugador] += parseFloat(data.importe || 0);
                }
            }
        });

        contenedor.innerHTML = "";
        const nombres = Object.keys(deudasTotales).sort();
        
        const datosParaGrafica = {};
        const estadosPagoParaGrafica = {};

        nombres.forEach(n => {
            const totalDebeHistorico = deudasTotales[n];
            const debeSoloEsteMes = deudasMesActual[n]; // <--- Usamos esta para el texto
            const totalPagado = pagosTotales[n];
            const saldoPendienteReal = Math.max(0, totalDebeHistorico - totalPagado);
            const alDia = saldoPendienteReal <= 0;

            // Para la gráfica seguimos usando el total del mes para que la barra mida eso
            datosParaGrafica[n] = debeSoloEsteMes; 
            estadosPagoParaGrafica[n] = {
                totalOriginal: debeSoloEsteMes,
                pagado: totalPagado, // Esto es para la lógica de colores (amarillo/verde)
                pendiente: saldoPendienteReal
            };

            contenedor.innerHTML += `
                <div onclick="confirmarPago('${n}', ${mesFiltro}, ${añoFiltro}, ${saldoPendienteReal})" 
                     class="total-item" 
                     style="display: flex; flex-direction: row; justify-content: space-between; padding: 12px; background-color: ${alDia ? '#eaffef' : '#ffffff'}; border-radius: 10px; margin-bottom: 8px; border: 1px solid ${alDia ? '#28a745' : '#eeeeee'}; cursor: pointer;">
                    <span>${alDia ? '✅ ' : ''}${n}</span>
                    <span style="font-weight: bold; color: ${alDia ? '#28a745' : 'black'}">
                        ${alDia ? 'AL DÍA' : debeSoloEsteMes + '€'}
                    </span>
                </div>`;
        });

        if (sumaTotalElemento) {
            sumaTotalElemento.innerText = totalSoloEsteMes + "€";
        }

        const esMovil = window.innerWidth < 600;
        renderizarGrafica(datosParaGrafica, estadosPagoParaGrafica, esMovil);

    } catch (e) { console.error("Error en totales:", e); }
}

function renderizarGrafica(datos, estadosPago, esMovil) {
    const canvas = document.getElementById('graficaMultas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (miGrafica) miGrafica.destroy(); 

    const labels = Object.keys(datos);
    const valores = Object.values(datos);

    // Definimos los colores dinámicamente
    const coloresBarras = labels.map(n => {
        const info = estadosPago[n];
        
        if (info.pendiente <= 0 && info.totalOriginal > 0) {
            // PAGADO TOTALMENTE
            return { bg: 'rgba(40, 167, 69, 0.7)', border: '#28a745' };
        } else if (info.pagado > 0 && info.pendiente > 0) {
            // PAGO PARCIAL
            return { bg: 'rgba(255, 193, 7, 0.7)', border: '#ffc107' };
        } else {
            // NO PAGADO O SIN DEUDA
            return { bg: 'rgba(255, 99, 132, 0.7)', border: '#ff4d4d' };
        }
    });

    const alturaBase = esMovil ? 40 : 35;
    canvas.style.height = (labels.length * alturaBase) + 'px';

    miGrafica = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Multas',
                data: valores,
                backgroundColor: coloresBarras.map(c => c.bg),
                borderColor: coloresBarras.map(c => c.border),
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const n = context.label;
                            const info = estadosPago[n];
                            return ` Total: ${info.totalOriginal}€ | Pagado: ${info.pagado}€ | Pendiente: ${info.pendiente}€`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { callback: value => value + '€' }
                }
            }
        }
    });
}

// --- EXPORTAR EXCEL ---
document.getElementById('btn-exportar').addEventListener('click', async () => {
    const selector = document.getElementById('selectorMes');
    const [mesFiltro, añoFiltro] = selector.value.split('-').map(Number);
    const nombreMes = selector.options[selector.selectedIndex].text;

    try {
        const [jugSnap, regSnap, multasSnap, pagosSnap] = await Promise.all([
            getDocs(collection(db, "Jugadores")),
            getDocs(collection(db, "Reglamento")),
            getDocs(collection(db, "Multas")),
            getDocs(collection(db, "Pagos"))
        ]);

        const jugadores = jugSnap.docs.map(d => d.data().nombre).sort();
        const infraccionesLimpias = regSnap.docs.map(d => d.data().infraccion).sort();
        
        const infraccionesCabecera = regSnap.docs
            .map(d => ({ nombre: d.data().infraccion, label: `${d.data().infraccion} (${d.data().importe}€)` }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
            .map(item => item.label);

        const estiloCabecera = {
            fill: { fgColor: { rgb: "FF4C4C" } },
            font: { bold: true, color: { rgb: "FFFFFF" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true }
        };

        const matriz = [];
        const cabeceraNombres = ["JUGADOR", ...infraccionesCabecera, "TOTAL", "JUGADOR", "NO PAGADO"];
        matriz.push(cabeceraNombres.map(titulo => ({ v: titulo, s: estiloCabecera })));

        // --- VARIABLES PARA EL SUMATORIO FINAL ---
        let sumaGlobalTotalMes = 0;
        let sumaGlobalNoPagado = 0;
        // -----------------------------------------

        jugadores.forEach(j => {
            let multasAnteriores = 0;
            let pagosAnteriores = 0;

            multasSnap.forEach(mDoc => {
                const d = mDoc.data();
                const f = d.fecha ? d.fecha.toDate() : null;
                if (f && d.jugadorNombre === j) {
                    if (f.getFullYear() < añoFiltro || (f.getFullYear() === añoFiltro && f.getMonth() < mesFiltro)) {
                        multasAnteriores += parseFloat(d.importe || 0);
                    }
                }
            });

            pagosSnap.forEach(pDoc => {
                const p = pDoc.data();
                if (p.jugador === j) {
                    if (p.año < añoFiltro || (p.año === añoFiltro && p.mes < mesFiltro)) {
                        pagosAnteriores += parseFloat(p.importe || 0);
                    }
                }
            });

            let deudaAnteriorAcumulada = Math.max(0, multasAnteriores - pagosAnteriores);

            let totalMesActual = 0;
            const fila = [{ v: j, s: { font: { bold: true }, alignment: { horizontal: "center"}, fill: { fgColor: { rgb: "EAEAEA" } } } }];

            infraccionesLimpias.forEach(inf => {
                let suma = 0;
                multasSnap.forEach(m => {
                    const d = m.data();
                    const f = d.fecha ? d.fecha.toDate() : null;
                    if (f && f.getMonth() === mesFiltro && f.getFullYear() === añoFiltro && d.jugadorNombre === j && d.reglaNombre === inf) {
                        suma += parseFloat(d.importe || 0);
                    }
                });
                fila.push({ v: suma || "", s: { alignment: { horizontal: "center" } } });
                totalMesActual += suma;
            });

            fila.push({ v: totalMesActual, s: { font: { bold: true }, fill: { fgColor: { rgb: "EAEAEA" } }, alignment: { horizontal: "center" } } });
            fila.push({ v: j, s: { font: { bold: true }, alignment: { horizontal: "center"}, fill: { fgColor: { rgb: "EAEAEA" } } } });

            const estiloNoPagado = {
                font: { bold: true, color: { rgb: "000000" } },
                fill: { fgColor: { rgb: deudaAnteriorAcumulada > 0 ? "FF4C4C" : "FFFFFF" } },
                alignment: { horizontal: "center" }
            };
            fila.push({ v: deudaAnteriorAcumulada, s: estiloNoPagado });

            matriz.push(fila);

            // --- ACUMULAMOS PARA EL TOTAL FINAL ---
            sumaGlobalTotalMes += totalMesActual;
            sumaGlobalNoPagado += deudaAnteriorAcumulada;
        });

        // --- AÑADIR FILA DE TOTALES GENERALES AL FINAL ---
        const estiloFilaTotal = { 
            font: { bold: true }, 
            fill: { fgColor: { rgb: "FFFF00" } }, // Amarillo para destacar
            alignment: { horizontal: "center" } 
        };

        const filaFinal = [];
        // Rellenamos con vacíos hasta llegar a las columnas de interés
        cabeceraNombres.forEach((col, index) => {
            if (index === 0) {
                filaFinal.push({ v: "TOTALES GENERALES", s: estiloFilaTotal });
            } else if (col === "TOTAL") {
                filaFinal.push({ v: sumaGlobalTotalMes, s: estiloFilaTotal });
            } else if (col === "NO PAGADO") {
                filaFinal.push({ v: sumaGlobalNoPagado, s: estiloFilaTotal });
            } else {
                filaFinal.push({ v: "", s: estiloFilaTotal });
            }
        });
        matriz.push(filaFinal);
        // --------------------------------------------------

        const ws = XLSX.utils.aoa_to_sheet(matriz);
        ws['!cols'] = cabeceraNombres.map(() => ({ wch: 20 }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Resumen");
        XLSX.writeFile(wb, `Multas_${nombreMes}.xlsx`);
        
    } catch (e) { 
        console.error("Error al exportar:", e); 
    }
});

// --- NAVEGACIÓN ---
linkRegistrar.addEventListener('click', () => { mostrarVista(viewRegistrar); linkRegistrar.classList.add('active'); });
linkHistorial.addEventListener('click', () => { mostrarVista(viewHistorial); linkHistorial.classList.add('active'); cargarHistorial(); });
linkTotales.addEventListener('click', () => { mostrarVista(viewTotales); linkTotales.classList.add('active'); cargarTotales(); });
document.getElementById('selectorMes').addEventListener('change', cargarTotales);