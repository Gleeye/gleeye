import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const formPayload = {
  id: '71111111-1111-1111-1111-111111111111',
  name: 'Premium Onboarding Form',
  description: 'Typeform clone test form',
  is_active: true,
  has_welcome_screen: true,
  welcome_title: "Hi there! Let's get started",
  welcome_description: "This will only take a minute.",
  welcome_button_text: "Let's Go",
  fields: [
    {id: "field_name", type: "text", label: "What is your full name?", required: true, placeholder: "John Doe"},
    {id: "field_email", type: "email", label: "What is your email address?", required: true, placeholder: "john@example.com"},
    {id: "field_budget", type: "radio", label: "What is your estimated budget?", options: ["< €1k", "€1k - €5k", "> €5k"], required: true},
    {id: "field_services", type: "checkbox", label: "Which services are you interested in?", options: ["Web Development", "Marketing", "Consulting"], required: false},
    {id: "field_details", type: "textarea", label: "Tell us a bit more about your project", required: false, rows: 4},
    {id: "field_terms", type: "acceptance", label: "I agree to the terms and conditions", required: true}
  ]
};

async function insertForm() {
  const { error } = await supabase.from('contact_forms').insert([formPayload]);
  if (error) {
    console.error("Error inserting form:", error);
  } else {
    console.log("Successfully inserted test form!");
  }
}

insertForm();
