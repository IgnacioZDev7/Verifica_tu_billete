/**
 * UNIFRANZ - Validador de Billetes
 * Lógica de manejo de interfaz y estados
 */

document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos de la interfaz
    const successModal = document.getElementById('success-modal');
    const errorModal = document.getElementById('error-modal');
    const scanButton = document.getElementById('scan-btn');
    const clearButtons = document.querySelectorAll('.clear-btn');
    const reportButton = document.getElementById('report-btn');

    // Función para mostrar éxito
    window.showSuccess = () => {
        successModal.classList.remove('hidden');
        successModal.classList.add('flex');
    };

    // Función para mostrar error
    window.showError = () => {
        errorModal.classList.remove('hidden');
        errorModal.classList.add('flex');
    };

    // Función para ocultar todos los modales
    window.hideModals = () => {
        [successModal, errorModal].forEach(modal => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        });
    };

    // Eventos
    if (scanButton) {
        scanButton.addEventListener('click', () => {
            // Simulamos escaneo
            console.log('Iniciando escaneo...');
            // Por demostración, mostramos éxito o error al azar
            if (Math.random() > 0.5) {
                showSuccess();
            } else {
                showError();
            }
        });
    }

    clearButtons.forEach(btn => {
        btn.addEventListener('click', hideModals);
    });

    if (reportButton) {
        reportButton.addEventListener('click', () => {
            alert('Incidencia reportada correctamente.');
            hideModals();
        });
    }
});
