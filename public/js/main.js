// Main JavaScript for Badminton Court Booking Platform

document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Initialize popovers
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // Auto-hide alerts after 5 seconds
    setTimeout(function() {
        var alerts = document.querySelectorAll('.alert');
        alerts.forEach(function(alert) {
            var bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        });
    }, 5000);

    // Court booking functionality
    initializeCourtBooking();
    
    // Search and filter functionality
    initializeSearchFilters();
    
    // Form validation
    initializeFormValidation();
});

// Court Booking Functions
function initializeCourtBooking() {
    // Date picker for booking
    const dateInput = document.getElementById('booking-date');
    if (dateInput) {
        dateInput.addEventListener('change', function() {
            loadTimeSlots();
        });
    }

    // Time slot selection
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('time-slot') && !e.target.classList.contains('booked')) {
            // Remove previous selection
            document.querySelectorAll('.time-slot.selected').forEach(slot => {
                slot.classList.remove('selected');
            });
            
            // Select current slot
            e.target.classList.add('selected');
            
            // Update booking form
            updateBookingForm();
        }
    });

    // Booking form submission
    // const bookingForm = document.getElementById('booking-form');
    // if (bookingForm) {
    //     bookingForm.addEventListener('submit', function(e) {
    //         e.preventDefault();
    //         submitBooking();
    //     });
    // }
}

// Load available time slots for selected date
function loadTimeSlots() {
    const dateInput = document.getElementById('booking-date');
    const courtId = document.getElementById('court-id').value;
    const timeSlotsContainer = document.getElementById('time-slots');
    
    if (!dateInput.value || !courtId) return;
    
    // Show loading
    timeSlotsContainer.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div><p class="mt-2">Loading time slots...</p></div>';
    
    fetch(`/courts/${courtId}/slots?date=${dateInput.value}`)
        .then(response => response.json())
        .then(slots => {
            displayTimeSlots(slots);
        })
        .catch(error => {
            console.error('Error loading time slots:', error);
            timeSlotsContainer.innerHTML = '<div class="alert alert-danger">Error loading time slots. Please try again.</div>';
        });
}

// Display time slots
function displayTimeSlots(slots) {
    const timeSlotsContainer = document.getElementById('time-slots');
    
    if (slots.length === 0) {
        timeSlotsContainer.innerHTML = '<div class="alert alert-info">No available time slots for this date.</div>';
        return;
    }
    
    let html = '<div class="row">';
    slots.forEach(slot => {
        html += `
            <div class="col-md-4 mb-2">
                <div class="time-slot ${slot.available ? '' : 'booked'}" 
                     data-start="${slot.start_time}" 
                     data-end="${slot.end_time}">
                    <div class="d-flex justify-content-between align-items-center">
                        <span>${slot.start_time} - ${slot.end_time}</span>
                        ${slot.available ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-times text-danger"></i>'}
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    timeSlotsContainer.innerHTML = html;
}

// Update booking form with selected time slot
function updateBookingForm() {
    const selectedSlot = document.querySelector('.time-slot.selected');
    if (!selectedSlot) return;
    
    const startTime = selectedSlot.dataset.start;
    const endTime = selectedSlot.dataset.end;
    
    document.getElementById('start-time').value = startTime;
    document.getElementById('end-time').value = endTime;
    
    // Calculate hours
    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${endTime}`);
    const hours = (end - start) / (1000 * 60 * 60);
    
    document.getElementById('total-hours').value = hours;
    
    // Update total amount if hourly rate is available
    const hourlyRate = document.getElementById('hourly-rate').value;
    if (hourlyRate) {
        const totalAmount = hourlyRate * hours;
        document.getElementById('total-amount').textContent = `RM${totalAmount.toFixed(2)}`;
    }
}

// Submit booking
function submitBooking() {
    const form = document.getElementById('booking-form');
    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => { data[key] = value; });
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    // Show loading
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing...';
    submitBtn.disabled = true;
    
    fetch('/bookings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('Booking created successfully!', 'success');
            // Redirect to booking details or payment page
            setTimeout(() => {
                window.location.href = `/bookings/${data.booking_id}`;
            }, 1500);
        } else {
            showAlert(data.error || 'Error creating booking', 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Error creating booking. Please try again.', 'danger');
    })
    .finally(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    });
}

// Search and Filter Functions
function initializeSearchFilters() {
    // Filter form submission
    const filterForm = document.getElementById('filter-form');
    if (filterForm) {
        filterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            applyFilters();
        });
    }
    
    // Clear filters
    const clearFiltersBtn = document.getElementById('clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', function() {
            clearFilters();
        });
    }
    
    // Real-time search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch(this.value);
            }, 500);
        });
    }
}

// Apply filters
function applyFilters() {
    const form = document.getElementById('filter-form');
    const formData = new FormData(form);
    const params = new URLSearchParams(formData);
    
    window.location.href = `/courts?${params.toString()}`;
}

// Clear filters
function clearFilters() {
    window.location.href = '/courts';
}

// Perform search
function performSearch(query) {
    if (query.length < 2) return;
    
    fetch(`/courts/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            displaySearchResults(data);
        })
        .catch(error => {
            console.error('Search error:', error);
        });
}

// Display search results
function displaySearchResults(results) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;
    
    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="alert alert-info">No courts found matching your search.</div>';
        return;
    }
    
    let html = '';
    results.forEach(court => {
        html += `
            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title">${court.name}</h5>
                    <p class="card-text">${court.address}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="text-primary fw-bold">RM${court.hourly_rate}/hour</span>
                        <a href="/courts/${court.id}" class="btn btn-primary btn-sm">View Details</a>
                    </div>
                </div>
            </div>
        `;
    });
    
    resultsContainer.innerHTML = html;
}

// Form Validation Functions
function initializeFormValidation() {
    // Password strength indicator
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            checkPasswordStrength(this.value);
        });
    }
    
    // Confirm password validation
    const confirmPasswordInput = document.getElementById('confirm-password');
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', function() {
            validatePasswordMatch();
        });
    }
    
    // Real-time form validation
    const forms = document.querySelectorAll('.needs-validation');
    forms.forEach(form => {
        form.addEventListener('submit', function(event) {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            form.classList.add('was-validated');
        });
    });
}

// Check password strength
function checkPasswordStrength(password) {
    const strengthIndicator = document.getElementById('password-strength');
    if (!strengthIndicator) return;
    
    let strength = 0;
    let feedback = '';
    
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    switch (strength) {
        case 0:
        case 1:
            feedback = 'Very Weak';
            strengthIndicator.className = 'text-danger';
            break;
        case 2:
            feedback = 'Weak';
            strengthIndicator.className = 'text-warning';
            break;
        case 3:
            feedback = 'Medium';
            strengthIndicator.className = 'text-info';
            break;
        case 4:
            feedback = 'Strong';
            strengthIndicator.className = 'text-success';
            break;
        case 5:
            feedback = 'Very Strong';
            strengthIndicator.className = 'text-success fw-bold';
            break;
    }
    
    strengthIndicator.textContent = feedback;
}

// Validate password match
function validatePasswordMatch() {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const matchIndicator = document.getElementById('password-match');
    
    if (!matchIndicator) return;
    
    if (confirmPassword === '') {
        matchIndicator.textContent = '';
        matchIndicator.className = '';
    } else if (password === confirmPassword) {
        matchIndicator.textContent = 'Passwords match';
        matchIndicator.className = 'text-success';
    } else {
        matchIndicator.textContent = 'Passwords do not match';
        matchIndicator.className = 'text-danger';
    }
}

// Utility Functions
function showAlert(message, type = 'info') {
    const alertContainer = document.createElement('div');
    alertContainer.className = `alert alert-${type} alert-dismissible fade show`;
    alertContainer.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.container');
    container.insertBefore(alertContainer, container.firstChild);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alertContainer.parentNode) {
            alertContainer.remove();
        }
    }, 5000);
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('ms-MY', {
        style: 'currency',
        currency: 'MYR'
    }).format(amount);
}

// Format date
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Format time
function formatTime(timeString) {
    return new Date(`2000-01-01 ${timeString}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export functions for use in other scripts
window.BadmintonApp = {
    showAlert,
    formatCurrency,
    formatDate,
    formatTime,
    debounce
}; 