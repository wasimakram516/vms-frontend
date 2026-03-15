// Mock custom fields service
export const getCustomFields = async () => {
  return [
    { id: "1", field_key: "full_name", label: "Full Name", input_type: "text", is_required: true, is_active: true, sort_order: 1 },
    { id: "2", field_key: "email", label: "Email Address", input_type: "email", is_required: true, is_active: true, sort_order: 2 },
    { id: "3", field_key: "phone", label: "Phone Number", input_type: "phone", is_required: false, is_active: true, sort_order: 3 },
    { id: "4", field_key: "company", label: "Company", input_type: "text", is_required: false, is_active: true, sort_order: 4 },
    { id: "5", field_key: "visit_purpose", label: "Visit Purpose", input_type: "select", is_required: true, is_active: true, sort_order: 5, options_json: ["Meeting", "Delivery", "Interview", "Other"] },
  ];
};
