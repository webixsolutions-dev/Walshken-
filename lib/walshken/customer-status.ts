export const inquiryStatuses = ["Received", "In review", "Resolved"] as const;
export type InquiryStatus = (typeof inquiryStatuses)[number];
