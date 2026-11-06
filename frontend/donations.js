// Function to show your custom inline modal popup
function showCustomModal(title, message, onConfirm) {
    const modal = document.getElementById('customModal');
    const titleEl = document.getElementById('modalTitle');
    const messageEl = document.getElementById('modalMessage');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (!modal) return; // safety check

    titleEl.innerText = title;
    messageEl.innerText = message;
    modal.style.display = 'flex';

    // Clear old event listeners by cloning buttons
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCloseBtn = closeBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

    // Handle Confirm click
    newConfirmBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        if (onConfirm) onConfirm();
    });

    // Handle Cancel / Close click
    newCloseBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
}

// Simulate donation interactions on page load
document.addEventListener("DOMContentLoaded", () => {
    const donationItems = document.querySelectorAll('.donation-item');

    donationItems.forEach((item) => {
        item.addEventListener("click", () => {
            const tierName = item.querySelector("p").innerText;
            
            // Trigger custom inline modal instead of browser confirm()
            showCustomModal(
                "Confirm Donation", 
                `Would you like to proceed with your contribution to ${tierName}?`, 
                () => {
                    // Trigger custom modal for success message
                    showCustomModal(
                        "Thank You!", 
                        `Your contribution for ${tierName} was processed successfully. 🎉`, 
                        null
                    );
                    
                    // Save simulation record to localStorage
                    let donationHistory = JSON.parse(localStorage.getItem('userDonations')) || [];
                    donationHistory.push({ tier: tierName, date: new Date().toISOString() });
                    localStorage.setItem('userDonations', JSON.stringify(donationHistory));
                }
            );
        });
    });
});