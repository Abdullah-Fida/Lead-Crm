// Demo data for the CRM dashboard — used when Supabase is not yet connected

export const demoLeadsWithWebsite = [
  { id: '1', business_name: 'Al-Shifa Medical Center', phone_number: '923001234567', website_url: 'https://alshifamedical.pk', address: 'Gulberg III, Lahore', rating: 4.5, reviews: 128, status: 'New', whatsapp_status: 'uncontacted', created_at: '2026-09-28T10:00:00Z' },
  { id: '2', business_name: 'Zameen Property Hub', phone_number: '923009876543', website_url: 'https://zameenhub.pk', address: 'DHA Phase 5, Karachi', rating: 4.2, reviews: 89, status: 'Contacted', whatsapp_status: 'sent', created_at: '2026-09-27T14:30:00Z' },
  { id: '3', business_name: 'FitZone Gym & Studio', phone_number: '923451234567', website_url: 'https://fitzonepk.com', address: 'F-7 Markaz, Islamabad', rating: 4.7, reviews: 215, status: 'Interested', whatsapp_status: 'delivered', created_at: '2026-09-26T09:15:00Z' },
  { id: '4', business_name: 'Advocate Rizwan & Partners', phone_number: '923331112233', website_url: 'https://rizwanlaw.pk', address: 'The Mall, Lahore', rating: 4.0, reviews: 42, status: 'Meeting', whatsapp_status: 'read', created_at: '2026-09-25T16:00:00Z' },
  { id: '5', business_name: 'Bright Future Academy', phone_number: '923211234567', website_url: 'https://brightfuture.edu.pk', address: 'Satellite Town, Rawalpindi', rating: 4.3, reviews: 167, status: 'New', whatsapp_status: 'uncontacted', created_at: '2026-09-24T11:45:00Z' },
  { id: '6', business_name: 'Royal Motors Showroom', phone_number: '923007654321', website_url: 'https://royalmotors.pk', address: 'Shahra-e-Faisal, Karachi', rating: 3.9, reviews: 54, status: 'Closed', whatsapp_status: 'sent', created_at: '2026-09-23T08:20:00Z' },
  { id: '7', business_name: 'Elegance Bridal Studio', phone_number: '923111234567', website_url: 'https://elegancebridal.pk', address: 'Liberty Market, Lahore', rating: 4.8, reviews: 312, status: 'New', whatsapp_status: 'uncontacted', created_at: '2026-09-22T13:00:00Z' },
  { id: '8', business_name: 'Karachi Dental Care', phone_number: '923009991111', website_url: 'https://karachidentalcare.com', address: 'Clifton Block 5, Karachi', rating: 4.6, reviews: 198, status: 'Contacted', whatsapp_status: 'sent', created_at: '2026-09-21T15:30:00Z' },
];

export const demoLeadsWithoutWebsite = [
  { id: '9', business_name: 'Khan Physiotherapy Clinic', phone_number: '923004445566', address: 'Model Town, Lahore', rating: 4.1, reviews: 23, status: 'New', whatsapp_status: 'uncontacted', created_at: '2026-09-28T09:00:00Z' },
  { id: '10', business_name: 'City Auto Workshop', phone_number: '923215556677', address: 'I.I. Chundrigar Road, Karachi', rating: 3.8, reviews: 45, status: 'New', whatsapp_status: 'uncontacted', created_at: '2026-09-27T12:00:00Z' },
  { id: '11', business_name: 'Noor Coaching Center', phone_number: '923337778899', address: 'Johar Town, Lahore', rating: 4.4, reviews: 87, status: 'Contacted', whatsapp_status: 'sent', created_at: '2026-09-26T10:30:00Z' },
  { id: '12', business_name: 'Paradise Wedding Hall', phone_number: '923009990011', address: 'GT Road, Gujranwala', rating: 4.0, reviews: 112, status: 'Interested', whatsapp_status: 'delivered', created_at: '2026-09-25T14:00:00Z' },
  { id: '13', business_name: 'Dr. Ahmed Dental Clinic', phone_number: '923451112233', address: 'F-8 Markaz, Islamabad', rating: 4.6, reviews: 56, status: 'New', whatsapp_status: 'uncontacted', created_at: '2026-09-24T08:45:00Z' },
  { id: '14', business_name: 'Star Beauty Salon', phone_number: '923007776655', address: 'Anarkali Bazaar, Lahore', rating: 3.7, reviews: 34, status: 'Rejected', whatsapp_status: 'failed', created_at: '2026-09-23T11:15:00Z' },
  { id: '15', business_name: 'Platinum Gym', phone_number: '923111239988', address: 'Bahria Town, Rawalpindi', rating: 4.2, reviews: 78, status: 'New', whatsapp_status: 'uncontacted', created_at: '2026-09-22T07:00:00Z' },
  { id: '16', business_name: 'Malik Travel & Tours', phone_number: '923008887766', address: 'Blue Area, Islamabad', rating: 4.0, reviews: 62, status: 'Contacted', whatsapp_status: 'queued', created_at: '2026-09-21T16:45:00Z' },
  { id: '17', business_name: 'Haq & Associates Law', phone_number: '923215554433', address: 'Saddar, Peshawar', rating: 4.3, reviews: 19, status: 'New', whatsapp_status: 'uncontacted', created_at: '2026-09-20T09:30:00Z' },
  { id: '18', business_name: 'Al-Noor Medical Store', phone_number: '923339998877', address: 'Wapda Town, Lahore', rating: 3.9, reviews: 41, status: 'New', whatsapp_status: 'uncontacted', created_at: '2026-09-19T13:00:00Z' },
];

export const demoCampaigns = [
  {
    id: 'c1',
    name: 'Dental Clinics — Chatbot Push',
    type: 'chatbot',
    status: 'active',
    dailyLimit: 20,
    delay: 60,
    sent: 42,
    pending: 18,
    failed: 3,
    createdAt: '2026-09-28T10:00:00Z',
  },
  {
    id: 'c2',
    name: 'Gyms — Website Development',
    type: 'website',
    status: 'paused',
    dailyLimit: 15,
    delay: 90,
    sent: 30,
    pending: 45,
    failed: 5,
    createdAt: '2026-09-26T14:00:00Z',
  },
  {
    id: 'c3',
    name: 'Real Estate — Chatbot Offer',
    type: 'chatbot',
    status: 'completed',
    dailyLimit: 25,
    delay: 45,
    sent: 50,
    pending: 0,
    failed: 2,
    createdAt: '2026-09-20T08:00:00Z',
  },
];

export const demoScraperLogs = [
  { time: '21:04:12', type: 'info', text: 'Scraper initialized — targeting "Dentists in Karachi"' },
  { time: '21:04:15', type: 'success', text: 'Found: Dr. Ahmed Dental Clinic — +92 300 999 0011' },
  { time: '21:04:18', type: 'success', text: 'Found: Karachi Dental Care — +92 300 999 1111 (has website)' },
  { time: '21:04:21', type: 'warning', text: 'Duplicate skipped: Dr. Ahmed Dental Clinic' },
  { time: '21:04:24', type: 'success', text: 'Found: Smile Dental Studio — +92 321 555 4433' },
  { time: '21:04:27', type: 'info', text: 'Scrolling for more results...' },
  { time: '21:04:32', type: 'success', text: 'Found: Pearl Dental Clinic — +92 333 777 8899' },
  { time: '21:04:35', type: 'success', text: 'Inserted: Pearl Dental Clinic → leads_without_website' },
  { time: '21:04:38', type: 'success', text: 'Found: DentaPro Lahore — +92 300 888 7766 (has website)' },
  { time: '21:04:41', type: 'info', text: 'Inserted: DentaPro Lahore → leads_with_website' },
  { time: '21:04:44', type: 'warning', text: 'Rate limited — pausing 5 seconds...' },
  { time: '21:04:50', type: 'success', text: 'Found: Family Dental — +92 321 123 4567' },
];
