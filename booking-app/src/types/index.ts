export type ServiceLogicType = 'OR' | 'AND' | 'TEAM_SIZE';

export interface BookingCategory {
    id: string;
    name: string;
    parent_id?: string;
    subcategories?: BookingCategory[];
}

export interface BookingItem {
    id: string;
    name: string;
    description?: string;
    price?: number;
    duration_minutes: number;
    buffer_minutes: number;
    logic_type: ServiceLogicType;
    team_size_req?: number;
    category_id?: string;
}

export interface Collaborator {
    id: string;
    full_name: string;
    avatar_url?: string;
}

export interface Booking {
    id: string;
    service_id: string;
    start_time: string; // ISO
    end_time: string; // ISO
    status: 'confirmed' | 'cancelled';
}

export interface Slot {
    start: Date;
    end: Date;
    availableCollaborators: string[];
}
