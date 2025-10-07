import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let allInventoryData = [];
let categories = [];

async function loadCategories() {
    try {
        const { data, error } = await supabase
            .from('seedling_categories')
            .select('*')
            .order('name');

        if (error) throw error;

        categories = data;
        populateCategoryFilter();
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

function populateCategoryFilter() {
    const categoryFilter = document.getElementById('categoryFilter');
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categoryFilter.appendChild(option);
    });
}

async function loadInventory() {
    try {
        const { data, error } = await supabase
            .from('inventory')
            .select(`
                *,
                seedling:seedlings (
                    *,
                    category:seedling_categories (
                        name
                    )
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        allInventoryData = data;
        displayInventory(data);
        updateDashboardStats(data);
    } catch (error) {
        console.error('Error loading inventory:', error);
        showError('Failed to load inventory. Please refresh the page.');
    }
}

function displayInventory(inventoryData) {
    const inventoryGrid = document.getElementById('inventoryGrid');

    if (!inventoryData || inventoryData.length === 0) {
        inventoryGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-seedling"></i>
                <p>No seedlings in inventory yet.</p>
            </div>
        `;
        return;
    }

    inventoryGrid.innerHTML = inventoryData.map(item => {
        const seedling = item.seedling;
        if (!seedling) return '';

        const stockStatus = getStockStatus(item.quantity_available, item.quantity_reserved);
        const categoryName = seedling.category?.name || 'Uncategorized';

        return `
            <div class="seedling-card" data-category="${seedling.category_id}" data-status="${stockStatus}">
                <img src="${seedling.image_url || 'forest2.jpeg'}" alt="${seedling.common_name}" class="seedling-image">
                <div class="seedling-info">
                    <div class="seedling-header">
                        <h3>${seedling.common_name}</h3>
                        <span class="stock-badge ${stockStatus}">${formatStockStatus(stockStatus)}</span>
                    </div>
                    <p class="seedling-scientific">${seedling.scientific_name}</p>
                    ${seedling.local_name ? `<p class="seedling-local">Local: ${seedling.local_name}</p>` : ''}
                    <span class="seedling-category"><i class="fas fa-tag"></i> ${categoryName}</span>

                    <div class="seedling-details">
                        <div class="detail-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${item.location || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-barcode"></i>
                            <span>${item.batch_number || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-tachometer-alt"></i>
                            <span>${seedling.growth_rate}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-sun"></i>
                            <span>${seedling.sunlight_requirements}</span>
                        </div>
                    </div>

                    <div class="seedling-stats">
                        <div class="stat-item-small">
                            <span class="number">${item.quantity_available}</span>
                            <span class="label">Available</span>
                        </div>
                        <div class="stat-item-small">
                            <span class="number">${item.quantity_reserved}</span>
                            <span class="label">Reserved</span>
                        </div>
                        <div class="stat-item-small">
                            <span class="number">${item.quantity_available + item.quantity_reserved}</span>
                            <span class="label">Total</span>
                        </div>
                    </div>

                    <div class="price-tag">
                        KES ${parseFloat(seedling.price_per_seedling).toFixed(2)} / seedling
                    </div>

                    ${item.ready_for_sale_date ? `
                        <div class="detail-item" style="margin-top: 1rem;">
                            <i class="fas fa-calendar-check"></i>
                            <span>Ready: ${formatDate(item.ready_for_sale_date)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function getStockStatus(available, reserved) {
    const total = available + reserved;
    if (available === 0) return 'out-of-stock';
    if (total < 50) return 'low-stock';
    return 'available';
}

function formatStockStatus(status) {
    const statusMap = {
        'available': 'In Stock',
        'low-stock': 'Low Stock',
        'out-of-stock': 'Out of Stock'
    };
    return statusMap[status] || status;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function updateDashboardStats(inventoryData) {
    let totalSeedlings = 0;
    let reservedSeedlings = 0;
    let totalValue = 0;

    inventoryData.forEach(item => {
        const available = item.quantity_available || 0;
        const reserved = item.quantity_reserved || 0;
        const price = parseFloat(item.seedling?.price_per_seedling || 0);

        totalSeedlings += available + reserved;
        reservedSeedlings += reserved;
        totalValue += (available + reserved) * price;
    });

    const uniqueSpecies = new Set(inventoryData.map(item => item.seedling_id)).size;

    document.getElementById('totalSeedlings').textContent = totalSeedlings.toLocaleString();
    document.getElementById('totalSpecies').textContent = uniqueSpecies;
    document.getElementById('reservedSeedlings').textContent = reservedSeedlings.toLocaleString();
    document.getElementById('totalValue').textContent = `KES ${totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    animateNumbers();
}

function animateNumbers() {
    const statElements = document.querySelectorAll('.stat-info h3');
    statElements.forEach(element => {
        element.style.animation = 'none';
        setTimeout(() => {
            element.style.animation = 'countUp 1s ease';
        }, 10);
    });
}

async function loadRecentActivities() {
    try {
        const { data, error } = await supabase
            .from('activities')
            .select(`
                *,
                seedling:seedlings (
                    common_name
                )
            `)
            .order('activity_date', { ascending: false })
            .limit(10);

        if (error) throw error;

        displayActivities(data);
    } catch (error) {
        console.error('Error loading activities:', error);
    }
}

function displayActivities(activities) {
    const activitiesList = document.getElementById('activitiesList');

    if (!activities || activities.length === 0) {
        activitiesList.innerHTML = '<p class="empty-state">No recent activities.</p>';
        return;
    }

    activitiesList.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-header">
                <span class="activity-type">
                    <i class="fas fa-${getActivityIcon(activity.activity_type)}"></i>
                    ${activity.activity_type}
                </span>
                <span class="activity-date">${formatDate(activity.activity_date)}</span>
            </div>
            <div class="activity-details">
                ${activity.seedling?.common_name ? `<strong>${activity.seedling.common_name}</strong> - ` : ''}
                ${activity.notes || 'No details provided'}
                ${activity.quantity_affected ? ` (${activity.quantity_affected} seedlings)` : ''}
                ${activity.performed_by ? ` - by ${activity.performed_by}` : ''}
            </div>
        </div>
    `).join('');
}

function getActivityIcon(activityType) {
    const iconMap = {
        'Seed Collection': 'leaf',
        'Germination': 'seedling',
        'Transplanting': 'exchange-alt',
        'Watering': 'tint',
        'Fertilizing': 'flask',
        'Pest Control': 'bug',
        'Quality Check': 'check-circle'
    };
    return iconMap[activityType] || 'clipboard-list';
}

function setupFilters() {
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const statusFilter = document.getElementById('statusFilter');

    searchInput.addEventListener('input', filterInventory);
    categoryFilter.addEventListener('change', filterInventory);
    statusFilter.addEventListener('change', filterInventory);
}

function filterInventory() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryId = document.getElementById('categoryFilter').value;
    const status = document.getElementById('statusFilter').value;

    let filteredData = allInventoryData.filter(item => {
        const seedling = item.seedling;
        if (!seedling) return false;

        const matchesSearch = !searchTerm ||
            seedling.common_name.toLowerCase().includes(searchTerm) ||
            seedling.scientific_name.toLowerCase().includes(searchTerm) ||
            seedling.local_name.toLowerCase().includes(searchTerm);

        const matchesCategory = !categoryId || seedling.category_id === categoryId;

        const itemStatus = getStockStatus(item.quantity_available, item.quantity_reserved);
        const matchesStatus = !status || itemStatus === status;

        return matchesSearch && matchesCategory && matchesStatus;
    });

    displayInventory(filteredData);
}

function showError(message) {
    const inventoryGrid = document.getElementById('inventoryGrid');
    inventoryGrid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${message}</p>
        </div>
    `;
}

async function initialize() {
    await loadCategories();
    await loadInventory();
    await loadRecentActivities();
    setupFilters();

    const inventoryChannel = supabase
        .channel('inventory-changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'inventory' },
            () => {
                loadInventory();
            }
        )
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'activities' },
            () => {
                loadRecentActivities();
            }
        )
        .subscribe();
}

document.addEventListener('DOMContentLoaded', initialize);
