export type BookingChannel = "airbnb" | "booking" | "direct" | "other";
export type BookingStatus = "pending" | "in_progress" | "ready" | "registered" | "cancelled";
export type PartyType = "single" | "family" | "group";
export type DocumentType = "passport" | "id_card" | "driving_licence" | "other";

export interface Property {
  id: string;
  name: string;
  host_name: string | null;
  host_tax_code: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  cin: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  alloggiati_apartment_id: string | null;
  tax_rate_per_night: number | null;
  tax_max_nights: number | null;
  tax_exempt_under_age: number | null;
  contract_template: string | null;
  guest_instructions: Record<string, string>;
  access_instructions: Record<string, string>;
  nuki_smartlock_id: string | null;
}

export interface IcalFeed {
  id: string;
  property_id: string;
  channel: BookingChannel;
  url: string;
  last_synced_at: string | null;
  last_error: string | null;
}

export interface Booking {
  id: string;
  property_id: string;
  channel: BookingChannel;
  external_ref: string | null;
  ical_uid: string | null;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  infants: number;
  party: PartyType;
  lead_name: string | null;
  lead_email: string | null;
  lead_phone: string | null;
  total_amount: number | null;
  notes: string | null;
  status: BookingStatus;
  guest_token: string;
  contract_accepted_at: string | null;
  contract_accepted_name: string | null;
  arrival_requested_at: string | null;
  identification_request: IdentificationRequest | null;
  identification_slot_at: string | null;
  identified_at: string | null;
  access_code: string | null;
  access_code_auth_id: string | null;
  access_code_error: string | null;
}

export type IdentificationRequest = "video_now" | "video_slot" | "in_person";
export type IdentificationMethod = "video_call" | "in_person";

export interface Identification {
  id: string;
  guest_id: string;
  booking_id: string;
  method: IdentificationMethod;
  verified_by: string;
  verified_at: string;
  document_type: DocumentType | null;
  document_number: string | null;
  revoked_at: string | null;
}

export interface Guest {
  id: string;
  booking_id: string;
  position: number;
  first_name: string;
  last_name: string;
  sex: "M" | "F" | null;
  birth_date: string | null;
  birth_place: string | null;
  birth_province: string | null;
  birth_country: string | null;
  citizenship: string | null;
  tax_code: string | null;
  residence_address: string | null;
  residence_city: string | null;
  residence_country: string | null;
  document_type: DocumentType | null;
  document_number: string | null;
  document_issue_place: string | null;
  document_issue_country: string | null;
  document_expiry: string | null;
  extraction: ExtractionInfo | null;
}

/** Dati anagrafici estratti da un documento, prima della conferma dell'ospite. */
export interface ExtractedGuest {
  first_name: string | null;
  last_name: string | null;
  sex: "M" | "F" | null;
  birth_date: string | null; // YYYY-MM-DD
  birth_place: string | null;
  birth_province: string | null;
  birth_country: string | null; // ISO alpha-3
  citizenship: string | null; // ISO alpha-3
  tax_code: string | null;
  residence_address: string | null;
  residence_city: string | null;
  residence_country: string | null;
  document_type: DocumentType | null;
  document_number: string | null;
  document_issue_place: string | null;
  document_issue_country: string | null;
  document_expiry: string | null;
}

export interface ExtractionInfo {
  source: "mrz" | "vision" | "mrz+vision" | "manual";
  mrz_valid: boolean | null;
  warnings: string[];
  extracted_at: string;
}

export const CHANNEL_LABEL: Record<BookingChannel, string> = {
  airbnb: "Airbnb",
  booking: "Booking.com",
  direct: "Diretta",
  other: "Altro",
};

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "In attesa dati",
  in_progress: "Dati parziali",
  ready: "Pronta da registrare",
  registered: "Registrata",
  cancelled: "Cancellata",
};

export const IDENTIFICATION_METHOD_LABEL: Record<IdentificationMethod, string> = {
  video_call: "in videochiamata",
  in_person: "di persona",
};
