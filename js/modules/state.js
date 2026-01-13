export const state = {
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
    selectedTags: [], // For the multi-select component
    currentId: null,
    passiveInvoices: [], // New state for passive invoices
    suppliers: [], // New state for suppliers
    lastSelectedPassiveYearCollab: null, // Tab state for collaborators
    lastSelectedPassiveYearSupplier: null, // Tab state for suppliers
    dashboardYear: 2025,
    dashboardTab: 'active',
    dashboardPassiveFilter: 'all',
    payments: null,
    movements: [],
    bankTransactions: [],
    transactionCategories: [],
    services: [], // Catalog of services
    collaboratorServices: [], // Registry of services assigned to collaborators
    assignments: [], // New state for assignments (Incarichi)
    selectedServiceDepartment: 'all',
    impersonatedRole: null, // 'admin' or 'collaborator' or null (default)
    impersonatedCollaboratorId: null // UUID of the collaborator being impersonated
};

window.state = state; // For debugging
