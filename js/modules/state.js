// ENSURE SINGLETON STATE ACROSS MODULE INSTANCES
if (!window.__gleeye_state) {
    window.__gleeye_state = {
        currentPage: 'dashboard',
        authMode: 'password',
        session: null,
        profile: null,
        orders: [],
        clients: [],
        collaborators: [],
        contacts: [],
        profiles: [],
        invoices: [],
        departments: [],
        searchTerm: '',
        selectedDepartment: '',
        showInactiveCollaborators: false,
        selectedTags: [],
        currentId: null,
        passiveInvoices: [],
        suppliers: [],
        lastSelectedPassiveYearCollab: null,
        lastSelectedPassiveYearSupplier: null,
        dashboardYear: 2026,
        dashboardTab: 'active',
        dashboardPassiveFilter: 'all',
        payments: null,
        movements: [],
        bankTransactions: [],
        pendingBankTransactions: [],
        transactionCategories: [],
        services: [],
        collaboratorServices: [],
        assignments: [],
        selectedServiceDepartment: 'all',
        impersonatedRole: null,
        impersonatedCollaboratorId: null,
        sapServices: [],
        sapServiceAreas: [],
        sapServiceTypes: [],
        currentSapVariant: null,
        payments: [], // Ensure payments exists just in case
        leads: []
    };
    window.state = window.__gleeye_state;
}

export const state = window.__gleeye_state;
