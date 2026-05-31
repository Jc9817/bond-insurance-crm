import type {
  Customer, Contact, Case, CaseNote, FollowUp, PicUser, User,
  CaseFile, ActivityLog, SettingsItem, WorkflowTemplate,
  Inquiry, InquiryQuotation, InquiryNote, InquiryDocument,
} from './types'

export const mockPics: PicUser[] = [
  { id: 'pic1', name: 'Ahmad Farid', email: 'ahmad@bondinsurance.com' },
  { id: 'pic2', name: 'Nurul Ain', email: 'nurul@bondinsurance.com' },
  { id: 'pic3', name: 'David Lim', email: 'david@bondinsurance.com' },
]

export const mockCustomers: Customer[] = [
  {
    id: 'cust1',
    customerName: 'Bina Perkasa Sdn Bhd',
    companyRegistrationNo: '199801012345',
    businessType: 'Sdn. Bhd.',
    industry: 'Construction',
    mainPhone: '03-12345678',
    mainEmail: 'admin@binaperkasa.com',
    notes: 'Key client. Handles large government construction projects.',
    createdAt: '2025-06-10T08:00:00Z',
  },
  {
    id: 'cust2',
    customerName: 'Maju Jaya Trading Sdn Bhd',
    companyRegistrationNo: '200201054321',
    businessType: 'Sdn. Bhd.',
    industry: 'Trading',
    mainPhone: '03-78912345',
    mainEmail: 'admin@majujaya.com',
    notes: 'Import and export trader. Requires customs bonds every year.',
    createdAt: '2025-08-20T09:00:00Z',
  },
  {
    id: 'cust3',
    customerName: 'Teknologi Canggih Sdn Bhd',
    companyRegistrationNo: '201501098765',
    businessType: 'Sdn. Bhd.',
    industry: 'Technology',
    mainPhone: '03-23456789',
    mainEmail: 'admin@tekcanggih.com',
    notes: 'IT company. Occasional bonds for government tenders.',
    createdAt: '2025-10-05T10:00:00Z',
  },
  {
    id: 'cust4',
    customerName: 'Mutiara Permai Sdn Bhd',
    companyRegistrationNo: '199901076543',
    businessType: 'Sdn. Bhd.',
    industry: 'Construction',
    mainPhone: '03-98765432',
    mainEmail: 'admin@mutiarapermai.com',
    notes: 'Property developer. Multiple bonds required per project.',
    createdAt: '2025-11-10T11:00:00Z',
  },
  {
    id: 'cust5',
    customerName: 'Prisma Logistics Sdn Bhd',
    companyRegistrationNo: '201801033210',
    businessType: 'Sdn. Bhd.',
    industry: 'Transportation',
    mainPhone: '03-55512345',
    mainEmail: 'admin@prismalogistics.com',
    notes: 'Freight forwarding. Needs customs bonds and workers compensation.',
    createdAt: '2026-01-15T09:00:00Z',
  },
]

export const mockContacts: Contact[] = [
  // Bina Perkasa (cust1)
  {
    id: 'con1', customerId: 'cust1', contactName: 'Razif Harun',
    role: 'Managing Director', phone: '012-3456789', email: 'razif@binaperkasa.com',
    contactType: 'Director', isPrimary: true,
  },
  {
    id: 'con2', customerId: 'cust1', contactName: 'Faridah Zain',
    role: 'Finance Manager', phone: '012-3456780', email: 'faridah@binaperkasa.com',
    contactType: 'Finance', isPrimary: false,
  },
  // Maju Jaya (cust2)
  {
    id: 'con3', customerId: 'cust2', contactName: 'Lee Chee Keong',
    role: 'Owner', phone: '016-7891234', email: 'cheekeong@majujaya.com',
    contactType: 'Owner', isPrimary: true,
  },
  {
    id: 'con4', customerId: 'cust2', contactName: 'Michelle Tan',
    role: 'Operations', phone: '016-7891235', email: 'michelle@majujaya.com',
    contactType: 'Operations', isPrimary: false,
  },
  // Teknologi Canggih (cust3)
  {
    id: 'con5', customerId: 'cust3', contactName: 'Sarah Tan',
    role: 'Operations Manager', phone: '011-23456789', email: 'sarah@tekcanggih.com',
    contactType: 'Manager', isPrimary: true,
  },
  {
    id: 'con6', customerId: 'cust3', contactName: 'James Ng',
    role: 'IT Director', phone: '011-23456780', email: 'james@tekcanggih.com',
    contactType: 'Director', isPrimary: false,
  },
  // Mutiara Permai (cust4)
  {
    id: 'con7', customerId: 'cust4', contactName: 'Hafizah Mohd',
    role: 'Director', phone: '019-9876543', email: 'hafizah@mutiarapermai.com',
    contactType: 'Director', isPrimary: true,
  },
  {
    id: 'con8', customerId: 'cust4', contactName: 'Azrul Nizam',
    role: 'Project Manager', phone: '019-9876544', email: 'azrul@mutiarapermai.com',
    contactType: 'Manager', isPrimary: false,
  },
  // Prisma Logistics (cust5)
  {
    id: 'con9', customerId: 'cust5', contactName: 'Kevin Wong',
    role: 'Managing Director', phone: '017-5551234', email: 'kevin@prismalogistics.com',
    contactType: 'Director', isPrimary: true,
  },
]

export const mockCases: Case[] = [
  {
    id: 'case1',
    caseTitle: 'Performance Bond — Projek Lebuh Raya MRR2',
    customerId: 'cust1',
    customerName: 'Bina Perkasa Sdn Bhd',
    caseType: 'Bond Request',
    amount: 250000,
    personInCharge: 'Ahmad Farid',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-01-28T10:00:00Z',
    currentStatus: 'Confirmed',
    currentWorkflowStepId: 'ws6',
    result: 'Won',
    closingRemarks: 'Bond issued by Allianz. Effective 1 Feb 2026.',
    finalInsurer: 'Allianz',
  },
  {
    id: 'case2',
    caseTitle: 'Customs Bond — Annual Renewal 2026',
    customerId: 'cust2',
    customerName: 'Maju Jaya Trading Sdn Bhd',
    caseType: 'Renewal',
    amount: 80000,
    personInCharge: 'Nurul Ain',
    createdAt: '2026-03-14T09:00:00Z',
    updatedAt: '2026-03-28T10:00:00Z',
    currentStatus: 'Submitted',
    currentWorkflowStepId: 'ws22',
    result: '',
    closingRemarks: '',
  },
  {
    id: 'case3',
    caseTitle: 'Performance Bond — MyGovIT System Integration',
    customerId: 'cust3',
    customerName: 'Teknologi Canggih Sdn Bhd',
    caseType: 'Bond Request',
    amount: 120000,
    personInCharge: 'David Lim',
    createdAt: '2026-04-01T10:00:00Z',
    updatedAt: '2026-04-10T11:00:00Z',
    currentStatus: 'Quoted',
    currentWorkflowStepId: 'ws4',
    result: '',
    closingRemarks: '',
  },
  {
    id: 'case4',
    caseTitle: 'Advance Payment Bond — Phase 3 Construction',
    customerId: 'cust4',
    customerName: 'Mutiara Permai Sdn Bhd',
    caseType: 'Bond Request',
    amount: 500000,
    personInCharge: 'Ahmad Farid',
    createdAt: '2026-04-20T08:00:00Z',
    updatedAt: '2026-05-03T09:00:00Z',
    currentStatus: 'Waiting Documents',
    currentWorkflowStepId: 'ws1',
    result: '',
    closingRemarks: '',
  },
  {
    id: 'case5',
    caseTitle: 'Fidelity Guarantee — Finance Department',
    customerId: 'cust1',
    customerName: 'Bina Perkasa Sdn Bhd',
    caseType: 'Insurance Request',
    amount: 50000,
    personInCharge: 'Nurul Ain',
    createdAt: '2026-04-28T09:00:00Z',
    updatedAt: '2026-04-28T09:00:00Z',
    currentStatus: 'New',
    currentWorkflowStepId: 'ws10',
    result: '',
    closingRemarks: '',
  },
  {
    id: 'case6',
    caseTitle: 'Immigration Bond — Foreign Workers Batch B',
    customerId: 'cust4',
    customerName: 'Mutiara Permai Sdn Bhd',
    caseType: 'Bond Request',
    amount: 35000,
    personInCharge: 'David Lim',
    createdAt: '2026-05-02T10:00:00Z',
    updatedAt: '2026-05-10T09:00:00Z',
    currentStatus: 'Sent to Customer',
    currentWorkflowStepId: 'ws5',
    result: '',
    closingRemarks: '',
  },
  {
    id: 'case7',
    caseTitle: 'Workers Compensation — Freight Team',
    customerId: 'cust5',
    customerName: 'Prisma Logistics Sdn Bhd',
    caseType: 'Insurance Request',
    amount: 15000,
    personInCharge: 'Ahmad Farid',
    createdAt: '2026-05-08T09:00:00Z',
    updatedAt: '2026-05-08T09:00:00Z',
    currentStatus: 'New',
    currentWorkflowStepId: 'ws10',
    result: '',
    closingRemarks: '',
  },
  {
    id: 'case8',
    caseTitle: 'Performance Bond — Coastal Highway Phase 1',
    customerId: 'cust1',
    customerName: 'Bina Perkasa Sdn Bhd',
    caseType: 'Bond Request',
    amount: 380000,
    personInCharge: 'Ahmad Farid',
    createdAt: '2025-09-01T08:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
    currentStatus: 'Closed',
    currentWorkflowStepId: 'ws6',
    result: 'Lost',
    closingRemarks: 'Client went with another agent offering a lower premium.',
    lossReason: 'Price — competitor offered lower premium',
    closedAt: '2025-12-15T10:00:00Z',
  },
]

export const mockCaseNotes: CaseNote[] = [
  {
    id: 'note1',
    caseId: 'case1',
    content: 'Client confirmed they want Allianz. Proceed with bond issuance.',
    createdAt: '2026-01-22T14:00:00Z',
    createdBy: 'Ahmad Farid',
  },
  {
    id: 'note2',
    caseId: 'case1',
    content: 'Bond issued. Original document couriered to client office.',
    createdAt: '2026-02-01T11:00:00Z',
    createdBy: 'Ahmad Farid',
  },
  {
    id: 'note3',
    caseId: 'case2',
    content: 'Submitted to Customs department. Reference: CUST-2026-00412.',
    createdAt: '2026-03-28T10:30:00Z',
    createdBy: 'Nurul Ain',
  },
  {
    id: 'note4',
    caseId: 'case3',
    content: 'Quotations from 3 insurers sent to client. Waiting for their decision.',
    createdAt: '2026-04-10T11:00:00Z',
    createdBy: 'David Lim',
  },
  {
    id: 'note5',
    caseId: 'case4',
    content: 'Client has not submitted audited accounts yet. Need to follow up.',
    createdAt: '2026-05-03T09:00:00Z',
    createdBy: 'Ahmad Farid',
  },
]

export const mockFollowUps: FollowUp[] = [
  {
    id: 'fu1',
    title: 'Call client to check on customs bond approval',
    customerId: 'cust2',
    customerName: 'Maju Jaya Trading Sdn Bhd',
    caseId: 'case2',
    caseTitle: 'Customs Bond — Annual Renewal 2026',
    personInCharge: 'Nurul Ain',
    dueDate: '2026-05-10',
    status: 'Open',
    createdAt: '2026-05-01T08:00:00Z',
  },
  {
    id: 'fu2',
    title: 'Collect audited accounts and company profile',
    customerId: 'cust4',
    customerName: 'Mutiara Permai Sdn Bhd',
    caseId: 'case4',
    caseTitle: 'Advance Payment Bond — Phase 3 Construction',
    personInCharge: 'Ahmad Farid',
    dueDate: '2026-05-05',
    status: 'Done',
    createdAt: '2026-04-28T09:00:00Z',
  },
  {
    id: 'fu3',
    title: 'Send quotation comparison to client for review',
    customerId: 'cust3',
    customerName: 'Teknologi Canggih Sdn Bhd',
    caseId: 'case3',
    caseTitle: 'Performance Bond — MyGovIT System Integration',
    personInCharge: 'David Lim',
    dueDate: '2026-05-20',
    status: 'Open',
    createdAt: '2026-05-10T10:00:00Z',
  },
  {
    id: 'fu4',
    title: 'Remind client about workers list for immigration bond',
    customerId: 'cust4',
    customerName: 'Mutiara Permai Sdn Bhd',
    caseId: 'case6',
    caseTitle: 'Immigration Bond — Foreign Workers Batch B',
    personInCharge: 'David Lim',
    dueDate: '2026-05-16',
    status: 'Open',
    createdAt: '2026-05-13T10:00:00Z',
  },
  {
    id: 'fu5',
    title: 'Prepare fidelity guarantee proposal document',
    customerId: 'cust1',
    customerName: 'Bina Perkasa Sdn Bhd',
    caseId: 'case5',
    caseTitle: 'Fidelity Guarantee — Finance Department',
    personInCharge: 'Nurul Ain',
    dueDate: '2026-05-22',
    status: 'Open',
    createdAt: '2026-05-14T09:00:00Z',
  },
  {
    id: 'fu6',
    title: 'Submit workers compensation proposal to insurer',
    customerId: 'cust5',
    customerName: 'Prisma Logistics Sdn Bhd',
    caseId: 'case7',
    caseTitle: 'Workers Compensation — Freight Team',
    personInCharge: 'Ahmad Farid',
    dueDate: '2026-05-30',
    status: 'Open',
    createdAt: '2026-05-08T11:00:00Z',
  },
]

// ─── Users ────────────────────────────────────────────────────────────────────

export const mockUsers: User[] = [
  {
    id: 'usr1',
    fullName: 'Admin',
    email: 'admin@trident.com',
    password: 'Trident123',
    role: 'Admin',
    status: 'Active',
    createdAt: '2024-01-01T08:00:00Z',
  },
  {
    id: 'usr2',
    fullName: 'Staff',
    email: 'staff@trident.com',
    password: 'Trident123',
    role: 'Staff',
    status: 'Active',
    createdAt: '2024-01-15T08:00:00Z',
  },
]

// ─── Case Files ───────────────────────────────────────────────────────────────

export const mockCaseFiles: CaseFile[] = [
  {
    id: 'file1',
    caseId: 'case1',
    fileName: 'Project_Contract_MRR2.pdf',
    fileSize: 2150000,
    fileType: 'PDF',
    documentType: 'Contract / Award Letter',
    requiredDocumentId: 'rd4',
    uploadedBy: 'Ahmad Farid',
    uploadedAt: '2026-01-12T10:00:00Z',
    aiScanned: true,
    aiStatus: 'Approved',
    aiExtractedData: {
      customerName: 'Bina Perkasa Sdn Bhd',
      projectName: 'Projek Lebuh Raya MRR2',
      caseType: 'Bond Request',
      amount: 'RM 250,000.00',
      bondValue: 'RM 250,000.00',
      expiryDate: '2027-01-31',
      notes: 'Performance bond for MRR2 road construction. Insurer: Allianz. Effective 1 Feb 2026.',
    },
  },
  {
    id: 'file2',
    caseId: 'case1',
    fileName: 'SSM_Certificate_BinaPerkasa.pdf',
    fileSize: 485000,
    fileType: 'PDF',
    documentType: 'SSM Certificate',
    requiredDocumentId: 'rd2',
    uploadedBy: 'Ahmad Farid',
    uploadedAt: '2026-01-12T10:15:00Z',
    aiScanned: false,
    aiStatus: 'Not Scanned',
    aiExtractedData: null,
  },
  {
    id: 'file3',
    caseId: 'case1',
    fileName: 'CompanyProfile_BinaPerkasa.pdf',
    fileSize: 1200000,
    fileType: 'PDF',
    documentType: 'Company Profile',
    requiredDocumentId: 'rd1',
    uploadedBy: 'Ahmad Farid',
    uploadedAt: '2026-01-12T10:20:00Z',
    aiScanned: false,
    aiStatus: 'Not Scanned',
    aiExtractedData: null,
  },
  {
    id: 'file4',
    caseId: 'case4',
    fileName: 'Audited_Accounts_2025.pdf',
    fileSize: 3200000,
    fileType: 'PDF',
    documentType: 'Financial Statement',
    requiredDocumentId: 'rd3',
    uploadedBy: 'Ahmad Farid',
    uploadedAt: '2026-05-03T09:30:00Z',
    aiScanned: false,
    aiStatus: 'Not Scanned',
    aiExtractedData: null,
  },
  {
    id: 'file5',
    caseId: 'case3',
    fileName: 'ApplicationForm_MyGovIT.pdf',
    fileSize: 520000,
    fileType: 'PDF',
    documentType: 'Application Form',
    requiredDocumentId: 'rd5',
    uploadedBy: 'David Lim',
    uploadedAt: '2026-04-03T11:00:00Z',
    aiScanned: false,
    aiStatus: 'Not Scanned',
    aiExtractedData: null,
  },
]

// ─── Activity Logs ────────────────────────────────────────────────────────────

export const mockActivityLogs: ActivityLog[] = [
  {
    id: 'log1',
    caseId: 'case1',
    caseTitle: 'Performance Bond — Projek Lebuh Raya MRR2',
    actionType: 'CASE_CREATED',
    title: 'Case created',
    description: 'New bond request case opened',
    changedBy: 'Ahmad Farid',
    timestamp: '2026-01-10T08:00:00Z',
  },
  {
    id: 'log2',
    caseId: 'case1',
    caseTitle: 'Performance Bond — Projek Lebuh Raya MRR2',
    actionType: 'STATUS_CHANGED',
    title: 'Status changed',
    oldValue: 'New',
    newValue: 'Waiting Documents',
    description: 'Status changed from New to Waiting Documents',
    changedBy: 'Ahmad Farid',
    timestamp: '2026-01-10T08:05:00Z',
  },
  {
    id: 'log3',
    caseId: 'case1',
    caseTitle: 'Performance Bond — Projek Lebuh Raya MRR2',
    actionType: 'DOCUMENT_UPLOADED',
    title: 'Document uploaded',
    newValue: 'Company Profile',
    description: 'CompanyProfile_BinaPerkasa.pdf uploaded',
    changedBy: 'Ahmad Farid',
    timestamp: '2026-01-12T10:00:00Z',
  },
  {
    id: 'log4',
    caseId: 'case1',
    caseTitle: 'Performance Bond — Projek Lebuh Raya MRR2',
    actionType: 'DOCUMENT_UPLOADED',
    title: 'Document uploaded',
    newValue: 'Contract / Award Letter',
    description: 'Project_Contract_MRR2.pdf uploaded',
    changedBy: 'Ahmad Farid',
    timestamp: '2026-01-12T10:02:00Z',
  },
  {
    id: 'log5',
    caseId: 'case1',
    caseTitle: 'Performance Bond — Projek Lebuh Raya MRR2',
    actionType: 'AI_SCAN_STARTED',
    title: 'AI scan started',
    description: 'AI scanning Project_Contract_MRR2.pdf',
    changedBy: 'Ahmad Farid',
    timestamp: '2026-01-12T10:03:00Z',
  },
  {
    id: 'log6',
    caseId: 'case1',
    caseTitle: 'Performance Bond — Projek Lebuh Raya MRR2',
    actionType: 'AI_EXTRACTION_APPROVED',
    title: 'AI extraction approved',
    description: 'Extracted data from Project_Contract_MRR2.pdf approved',
    changedBy: 'Ahmad Farid',
    timestamp: '2026-01-12T10:10:00Z',
  },
  {
    id: 'log7',
    caseId: 'case1',
    caseTitle: 'Performance Bond — Projek Lebuh Raya MRR2',
    actionType: 'WORKFLOW_STEP_CHANGED',
    title: 'Workflow step advanced',
    oldValue: 'Collect Documents',
    newValue: 'Submit to Insurer',
    description: 'Moved from Collect Documents to Submit to Insurer',
    changedBy: 'Ahmad Farid',
    timestamp: '2026-01-14T09:00:00Z',
  },
  {
    id: 'log8',
    caseId: 'case1',
    caseTitle: 'Performance Bond — Projek Lebuh Raya MRR2',
    actionType: 'STATUS_CHANGED',
    title: 'Status changed',
    oldValue: 'Waiting Documents',
    newValue: 'Submitted',
    description: 'Status changed from Waiting Documents to Submitted',
    changedBy: 'Ahmad Farid',
    timestamp: '2026-01-14T09:05:00Z',
  },
  {
    id: 'log9',
    caseId: 'case1',
    caseTitle: 'Performance Bond — Projek Lebuh Raya MRR2',
    actionType: 'FOLLOW_UP_CREATED',
    title: 'Follow-up created',
    description: 'Confirm payment receipt from client',
    changedBy: 'Ahmad Farid',
    timestamp: '2026-01-22T09:00:00Z',
  },
  {
    id: 'log10',
    caseId: 'case1',
    caseTitle: 'Performance Bond — Projek Lebuh Raya MRR2',
    actionType: 'NOTE_ADDED',
    title: 'Note added',
    description: 'Client confirmed they want Allianz. Proceed with bond issuance.',
    changedBy: 'Ahmad Farid',
    timestamp: '2026-01-22T14:00:00Z',
  },
  {
    id: 'log11',
    caseId: 'case1',
    caseTitle: 'Performance Bond — Projek Lebuh Raya MRR2',
    actionType: 'RESULT_SET',
    title: 'Case result set',
    oldValue: '',
    newValue: 'Won',
    description: 'Case marked as Won. Bond issued by Allianz.',
    changedBy: 'Ahmad Farid',
    timestamp: '2026-01-28T10:00:00Z',
  },
  {
    id: 'log12',
    caseId: 'case2',
    caseTitle: 'Customs Bond — Annual Renewal 2026',
    actionType: 'CASE_CREATED',
    title: 'Case created',
    description: 'New renewal case opened',
    changedBy: 'Nurul Ain',
    timestamp: '2026-03-14T09:00:00Z',
  },
  {
    id: 'log13',
    caseId: 'case2',
    caseTitle: 'Customs Bond — Annual Renewal 2026',
    actionType: 'STATUS_CHANGED',
    title: 'Status changed',
    oldValue: 'New',
    newValue: 'Submitted',
    description: 'Status changed from New to Submitted',
    changedBy: 'Nurul Ain',
    timestamp: '2026-03-28T10:00:00Z',
  },
  {
    id: 'log14',
    caseId: 'case2',
    caseTitle: 'Customs Bond — Annual Renewal 2026',
    actionType: 'NOTE_ADDED',
    title: 'Note added',
    description: 'Submitted to Customs department. Reference: CUST-2026-00412.',
    changedBy: 'Nurul Ain',
    timestamp: '2026-03-28T10:30:00Z',
  },
  {
    id: 'log15',
    caseId: 'case3',
    caseTitle: 'Performance Bond — MyGovIT System Integration',
    actionType: 'CASE_CREATED',
    title: 'Case created',
    description: 'New bond request case opened',
    changedBy: 'David Lim',
    timestamp: '2026-04-01T10:00:00Z',
  },
  {
    id: 'log16',
    caseId: 'case3',
    caseTitle: 'Performance Bond — MyGovIT System Integration',
    actionType: 'DOCUMENT_UPLOADED',
    title: 'Document uploaded',
    newValue: 'Application Form',
    description: 'ApplicationForm_MyGovIT.pdf uploaded',
    changedBy: 'David Lim',
    timestamp: '2026-04-03T11:00:00Z',
  },
  {
    id: 'log17',
    caseId: 'case3',
    caseTitle: 'Performance Bond — MyGovIT System Integration',
    actionType: 'STATUS_CHANGED',
    title: 'Status changed',
    oldValue: 'Submitted',
    newValue: 'Quoted',
    description: 'Status changed from Submitted to Quoted',
    changedBy: 'David Lim',
    timestamp: '2026-04-10T11:00:00Z',
  },
  {
    id: 'log18',
    caseId: 'case3',
    caseTitle: 'Performance Bond — MyGovIT System Integration',
    actionType: 'FOLLOW_UP_CREATED',
    title: 'Follow-up created',
    description: 'Send quotation comparison to client for review',
    changedBy: 'David Lim',
    timestamp: '2026-05-10T10:00:00Z',
  },
  {
    id: 'log19',
    caseId: 'case4',
    caseTitle: 'Advance Payment Bond — Phase 3 Construction',
    actionType: 'CASE_CREATED',
    title: 'Case created',
    description: 'New bond request case opened',
    changedBy: 'Ahmad Farid',
    timestamp: '2026-04-20T08:00:00Z',
  },
  {
    id: 'log20',
    caseId: 'case4',
    caseTitle: 'Advance Payment Bond — Phase 3 Construction',
    actionType: 'DOCUMENT_UPLOADED',
    title: 'Document uploaded',
    newValue: 'Financial Statement',
    description: 'Audited_Accounts_2025.pdf uploaded',
    changedBy: 'Ahmad Farid',
    timestamp: '2026-05-03T09:30:00Z',
  },
  {
    id: 'log21',
    caseId: 'case4',
    caseTitle: 'Advance Payment Bond — Phase 3 Construction',
    actionType: 'NOTE_ADDED',
    title: 'Note added',
    description: 'Client has not submitted audited accounts yet. Need to follow up.',
    changedBy: 'Ahmad Farid',
    timestamp: '2026-05-03T09:00:00Z',
  },
]

// ─── Editable Settings ────────────────────────────────────────────────────────

export const mockSettingsCaseTypes: SettingsItem[] = [
  { id: 'sct1', name: 'Bond Request', isActive: true },
  { id: 'sct2', name: 'Insurance Request', isActive: true },
  { id: 'sct3', name: 'Policy Issuance', isActive: true },
  { id: 'sct4', name: 'Renewal', isActive: true },
  { id: 'sct5', name: 'Endorsement', isActive: true },
  { id: 'sct6', name: 'Claim', isActive: true },
  { id: 'sct7', name: 'Servicing Request', isActive: true },
  { id: 'sct8', name: 'Quotation Request', isActive: true },
  { id: 'sct9', name: 'Other', isActive: true },
]

export const mockSettingsIndustries: SettingsItem[] = [
  { id: 'si1', name: 'Construction', isActive: true },
  { id: 'si2', name: 'Manufacturing', isActive: true },
  { id: 'si3', name: 'Trading', isActive: true },
  { id: 'si4', name: 'Retail', isActive: true },
  { id: 'si5', name: 'Services', isActive: true },
  { id: 'si6', name: 'Technology', isActive: true },
  { id: 'si7', name: 'Healthcare', isActive: true },
  { id: 'si8', name: 'Education', isActive: true },
  { id: 'si9', name: 'Transportation', isActive: true },
  { id: 'si10', name: 'Other', isActive: true },
]

export const mockSettingsContactTypes: SettingsItem[] = [
  { id: 'sco1', name: 'Owner', isActive: true },
  { id: 'sco2', name: 'Director', isActive: true },
  { id: 'sco3', name: 'Manager', isActive: true },
  { id: 'sco4', name: 'Finance', isActive: true },
  { id: 'sco5', name: 'Operations', isActive: true },
  { id: 'sco6', name: 'Worker', isActive: true },
  { id: 'sco7', name: 'Referral', isActive: true },
  { id: 'sco8', name: 'Introducer', isActive: true },
  { id: 'sco9', name: 'Other', isActive: true },
]

export const mockSettingsFollowUpCategories: SettingsItem[] = [
  { id: 'sfu1', name: 'Client Follow-Up', isActive: true },
  { id: 'sfu2', name: 'Insurer Follow-Up', isActive: true },
  { id: 'sfu3', name: 'Renewal Reminder', isActive: true },
  { id: 'sfu4', name: 'Documentation', isActive: true },
  { id: 'sfu5', name: 'Internal', isActive: true },
  { id: 'sfu6', name: 'Payment', isActive: true },
  { id: 'sfu7', name: 'Other', isActive: true },
]

export const mockSettingsDocumentTypes: SettingsItem[] = [
  { id: 'sdt1', name: 'Contract / Award Letter', isActive: true },
  { id: 'sdt2', name: 'Financial Statement', isActive: true },
  { id: 'sdt3', name: 'SSM Certificate', isActive: true },
  { id: 'sdt4', name: 'Application Form', isActive: true },
  { id: 'sdt5', name: 'Quotation', isActive: true },
  { id: 'sdt6', name: 'Company Profile', isActive: true },
  { id: 'sdt7', name: 'Bank Statement', isActive: true },
  { id: 'sdt8', name: 'Identity Card', isActive: true },
  { id: 'sdt9', name: 'Previous Policy / Bond', isActive: true },
  { id: 'sdt10', name: 'Supporting Document', isActive: true },
  { id: 'sdt11', name: 'Other', isActive: true },
]

export const mockSettingsInquiryStatuses: SettingsItem[] = [
  { id: 'sis1', name: 'New', isActive: true },
  { id: 'sis2', name: 'Gathering Info', isActive: true },
  { id: 'sis3', name: 'Docs Requested', isActive: true },
  { id: 'sis4', name: 'Quotation Requested', isActive: true },
  { id: 'sis5', name: 'Quotation Received', isActive: true },
  { id: 'sis6', name: 'Customer Reviewing', isActive: true },
  { id: 'sis7', name: 'Qualified', isActive: true },
  { id: 'sis8', name: 'Closed', isActive: true },
  { id: 'sis9', name: 'Lost', isActive: true },
]

export const mockSettingsQuotationStatuses: SettingsItem[] = [
  { id: 'sqs1', name: 'Pending', isActive: true },
  { id: 'sqs2', name: 'Quoted', isActive: true },
  { id: 'sqs3', name: 'Under Review', isActive: true },
  { id: 'sqs4', name: 'Rejected', isActive: true },
  { id: 'sqs5', name: 'No Response', isActive: true },
]

export const mockSettingsInsurers: SettingsItem[] = [
  { id: 'sins1', name: 'Allianz Malaysia', isActive: true },
  { id: 'sins2', name: 'Etiqa Takaful', isActive: true },
  { id: 'sins3', name: 'RHB Insurance', isActive: true },
  { id: 'sins4', name: 'Zurich Insurance', isActive: true },
  { id: 'sins5', name: 'AIA Malaysia', isActive: true },
  { id: 'sins6', name: 'Tokio Marine', isActive: true },
  { id: 'sins7', name: 'Berjaya Sompo', isActive: true },
  { id: 'sins8', name: 'MSIG Insurance', isActive: true },
]

// ─── Workflow Templates ───────────────────────────────────────────────────────

export const mockWorkflowTemplates: WorkflowTemplate[] = [
  {
    id: 'wt1',
    caseType: 'Bond Request',
    businessType: 'Sdn. Bhd.',
    description: 'Bond request workflow for Sdn. Bhd. / company applicants — from LOA receipt to bond issuance.',
    isActive: true,
    requiredDocuments: [
      // ── Step 1: Receive Letter of Award ──
      {
        id: 'rd4', caseTypeId: 'wt1', workflowStepId: 'ws0',
        name: 'Letter of Award (LOA)',
        description: 'Surat Setuju Terima (SST) or Letter of Award from the project owner confirming contract award',
        required: true,
        acceptedFileTypes: ['PDF', 'DOCX'], isActive: true,
        aiPrompt: `This is a Surat Setuju Terima (SST) / Letter of Award / Contract Acceptance from a Malaysian government agency.

Extract the following fields and return as a single JSON object:

1. customerName
   The CONTRACTOR's full company name AND registration number
   Look for: company awarded the contract — "Enterprise", "Sdn. Bhd.", "Sdn Bhd", "Trading", "Resources"
   NOT the government agency or university
   Example: "MASAYU ENTERPRISE 198003027177 (000504744-H)"
   Example: "TNO RESOURCES (003356082-V)"

2. projectName
   The full project/works description exactly as written in the document
   Look for: "Kerja-Kerja", "Skop Kerja", "Perihal Kerja", or the bold heading after "Sebutharga Untuk"
   Copy the full text — do not shorten or summarise

3. caseType
   The type of bond or security required
   Look for: "Bon Pelaksanaan", "Wang Jaminan Perlaksanaan", "Jaminan Bank"
   Return in English: "Performance Bond" or "Bank Guarantee" or "Cash Deposit"

4. amount
   The total awarded contract value
   Look for: "Harga Kontrak", "Harga Sebutharga", "Harga Tender", "harga sebanyak Ringgit Malaysia"
   Return as number only e.g. 267740

5. bondValue
   The performance bond / deposit amount
   Look for: "Nilai Bon Pelaksanaan", "bon pelaksanaan...berjumlah", typically 5% of contract value
   Return as number only e.g. 13387

6. thirdPartyLiability
   The public liability insurance value
   Look for: "Polisi Insurans Tanggungan Awam", "Nilai Polisi" under Tanggungan Awam section
   Return as number only e.g. 100000

7. workStartDate
   The date work is allowed to begin / site possession date
   Look for: "Tarikh Mula Kerja", "Tarikh Milik Tapak"
   Return as YYYY-MM-DD

8. workEndDate
   The contract completion date
   Look for: "Tarikh Siap", "Tarikh Tamat Kerja", "Tarikh Siap Kerja"
   Return as YYYY-MM-DD

9. dlpEndDate
   The end date of the Defect Liability Period (DLP / Tempoh Tanggungan Kecacatan)
   STEP 1 — Look for an explicit date first under "Tempoh Sah Laku" or "Tempoh Perlindungan"
   STEP 2 — If not found, CALCULATE: workEndDate + 12 months + 3 months + 14 days
   Return as YYYY-MM-DD

10. workInsuranceValue
    Contractors All Risk (CAR) / Polisi Insurans Kerja policy value. Usually equals contract value.
    Return as number only

11. sebuthargaNo
    Tender/quotation reference. Look for "No. Sebutharga", "No. Tender". Return null if not found.

12. sstNo
    Primary contract reference. Priority: (a) No. Surat Setuju Terima (b) No. Kontrak (c) Rujukan
    Return as string

13. issuingAgency
    The government agency or university issuing this contract (NOT the contractor)
    e.g. "Universiti Kebangsaan Malaysia (UKM)"

14. latePenaltyRate
    Daily late completion penalty. Fixed table rate or LAD formula (rate% × amount / 365).
    Return as number only

15. bondValidUntil
    Bond expiry date from "Tempoh Sah Laku" under "Bon Pelaksanaan".
    If not explicit: amount ≤ RM10M → dlpEndDate + 12 months; > RM10M → dlpEndDate + 24 months
    Return as YYYY-MM-DD

16. dlpBreakdown
    { "dlpMonths": number, "bufferMonths": number, "bufferDays": number, "label": string }
    Default: { "dlpMonths": 12, "bufferMonths": 3, "bufferDays": 14, "label": "12MONTHS + 3MONTHS + 14DAYS" }

Return this exact JSON structure:
{
  "customerName": string | null,
  "projectName": string | null,
  "caseType": string | null,
  "amount": number | null,
  "bondValue": number | null,
  "thirdPartyLiability": number | null,
  "workStartDate": string | null,
  "workEndDate": string | null,
  "dlpEndDate": string | null,
  "workInsuranceValue": number | null,
  "sebuthargaNo": string | null,
  "sstNo": string | null,
  "issuingAgency": string | null,
  "latePenaltyRate": number | null,
  "bondValidUntil": string | null,
  "dlpBreakdown": { "dlpMonths": number, "bufferMonths": number, "bufferDays": number, "label": string }
}`,
      },
      // ── Step 4: Collect Application Documents ──
      {
        id: 'rd1', caseTypeId: 'wt1', workflowStepId: 'ws3',
        name: 'Company Profile',
        description: 'Company background, business overview, and track record (minimum 2 pages)', required: true,
        acceptedFileTypes: ['PDF', 'DOCX'], isActive: true,
      },
      {
        id: 'rd2', caseTypeId: 'wt1', workflowStepId: 'ws3',
        name: 'SSM Certificate',
        description: 'Companies Commission of Malaysia (SSM) registration certificate — Form 9, 13, 24, 49', required: true,
        acceptedFileTypes: ['PDF', 'JPG', 'PNG'], isActive: true,
      },
      {
        id: 'rd3', caseTypeId: 'wt1', workflowStepId: 'ws3',
        name: 'Latest Audited Financial Statement',
        description: 'Audited accounts for the last 2 financial years (signed by auditor)', required: true,
        acceptedFileTypes: ['PDF', 'XLSX'], isActive: true,
      },
      {
        id: 'rd5', caseTypeId: 'wt1', workflowStepId: 'ws3',
        name: 'Bond Application Form',
        description: 'Completed and signed bond application form from insurer (obtain from insurer or company letterhead)', required: true,
        acceptedFileTypes: ['PDF', 'DOCX'], isActive: true,
      },
      {
        id: 'rd7', caseTypeId: 'wt1', workflowStepId: 'ws3',
        name: "Director's IC / MyKad",
        description: "Copy of MyKad (front and back) for all directors listed in SSM", required: true,
        acceptedFileTypes: ['PDF', 'JPG', 'PNG'], isActive: true,
      },
      {
        id: 'rd8', caseTypeId: 'wt1', workflowStepId: 'ws3',
        name: 'Authorization Letter',
        description: 'Company authorization letter for bond application, signed by director and company stamp', required: true,
        acceptedFileTypes: ['PDF', 'DOCX'], isActive: true,
      },
      {
        id: 'rd6', caseTypeId: 'wt1', workflowStepId: 'ws3',
        name: 'Bank Statement',
        description: 'Latest 3 months company bank statement (all accounts)', required: false,
        acceptedFileTypes: ['PDF'], isActive: true,
      },
    ],
    workflowSteps: [
      {
        id: 'ws0', caseTypeId: 'wt1', name: 'Receive LOA', order: 1,
        description: 'Client submits Letter of Award (LOA). Verify project name, bond value, bond type, and principal entity before proceeding.',
        requireDocumentsComplete: true,
        defaultFollowUpSuggestion: 'Verify LOA details and confirm bond requirements with client',
        isActive: true,
        slaDays: 2,
      },
      {
        id: 'ws1', caseTypeId: 'wt1', name: 'Request Quotation', order: 2,
        description: 'Send quotation requests to selected insurers with LOA and project details. Use the email panel to contact multiple insurers at once.',
        requireDocumentsComplete: false,
        defaultFollowUpSuggestion: 'Follow up with insurers for outstanding quotations',
        isActive: true,
        aiEmailEnabled: true,
        slaDays: 5,
      },
      {
        id: 'ws2', caseTypeId: 'wt1', name: 'Quote to Client', order: 3,
        description: 'Compare received quotations on premium rate, terms, and insurer reputation. Prepare a summary and present your recommendation to the client.',
        requireDocumentsComplete: false,
        defaultFollowUpSuggestion: 'Follow up with client on preferred insurer selection',
        isActive: true,
        slaDays: 3,
      },
      {
        id: 'ws3', caseTypeId: 'wt1', name: 'Collect Documents', order: 4,
        description: 'Client has confirmed insurer selection. Collect all required documents: company profile, SSM, director IC, authorization letter, financial statements, and application form.',
        requireDocumentsComplete: true,
        defaultFollowUpSuggestion: 'Chase client for outstanding application documents',
        isActive: true,
        slaDays: 7,
      },
      {
        id: 'ws4', caseTypeId: 'wt1', name: 'Confirm Payment', order: 5,
        description: 'Client settles premium payment. Confirm amount received, issue official receipt, and prepare final submission package for insurer.',
        requireDocumentsComplete: false,
        defaultFollowUpSuggestion: 'Confirm payment received and issue receipt to client',
        isActive: true,
        slaDays: 2,
      },
      {
        id: 'ws5', caseTypeId: 'wt1', name: 'Issue Bond', order: 6,
        description: 'Submit complete documentation to insurer. Follow up for bond certificate. On receipt, verify principal name, sum insured, and bond validity period.',
        requireDocumentsComplete: true,
        defaultFollowUpSuggestion: 'Follow up with insurer for bond certificate issuance',
        isActive: true,
        slaDays: 5,
      },
      {
        id: 'ws6', caseTypeId: 'wt1', name: 'Close Case', order: 7,
        description: 'Deliver bond certificate to client. Record acceptance date, bond expiry, and final insurer. Set renewal reminder 90 days before bond expiry.',
        requireDocumentsComplete: true,
        defaultFollowUpSuggestion: 'Confirm client received bond certificate and record bond expiry date',
        isActive: true,
        slaDays: 1,
      },
    ],
  },
  {
    id: 'wt2',
    caseType: 'Insurance Request',
    description: 'Standard insurance application and issuance process.',
    isActive: true,
    requiredDocuments: [
      {
        id: 'rd10', caseTypeId: 'wt2', name: 'Application Form',
        description: 'Completed insurance application form', required: true,
        acceptedFileTypes: ['PDF', 'DOCX'], isActive: true,
      },
      {
        id: 'rd11', caseTypeId: 'wt2', name: 'Identity Card',
        description: 'Copy of IC or passport (directors/owners)', required: true,
        acceptedFileTypes: ['PDF', 'JPG', 'PNG'], isActive: true,
      },
      {
        id: 'rd12', caseTypeId: 'wt2', name: 'Supporting Documents',
        description: 'Additional documents specific to the policy type', required: false,
        acceptedFileTypes: ['PDF', 'DOCX', 'JPG'], isActive: true,
      },
    ],
    workflowSteps: [
      {
        id: 'ws09', caseTypeId: 'wt2', name: 'Send out for Quotation', order: 1,
        description: 'Send quotation request to insurer(s) via AI-composed email',
        requireDocumentsComplete: false,
        defaultFollowUpSuggestion: 'Follow up with insurer on quotation request',
        isActive: true,
        aiEmailEnabled: true,
      },
      {
        id: 'ws10', caseTypeId: 'wt2', name: 'Collect Requirements', order: 2,
        description: 'Understand client needs and collect required documents',
        requireDocumentsComplete: false,
        defaultFollowUpSuggestion: 'Contact client for insurance requirements',
        isActive: true,
      },
      {
        id: 'ws11', caseTypeId: 'wt2', name: 'Get Quotation', order: 3,
        description: 'Obtain quotations from suitable insurers',
        requireDocumentsComplete: true,
        defaultFollowUpSuggestion: 'Request quotation from insurer',
        isActive: true,
      },
      {
        id: 'ws12', caseTypeId: 'wt2', name: 'Present to Customer', order: 4,
        description: 'Present and explain quotation options to client',
        requireDocumentsComplete: true,
        defaultFollowUpSuggestion: 'Follow up with client on insurance proposal',
        isActive: true,
      },
      {
        id: 'ws13', caseTypeId: 'wt2', name: 'Confirm Policy', order: 5,
        description: 'Client confirms chosen policy and authorizes payment',
        requireDocumentsComplete: true,
        defaultFollowUpSuggestion: 'Confirm policy acceptance and collect payment',
        isActive: true,
      },
      {
        id: 'ws14', caseTypeId: 'wt2', name: 'Issue Certificate', order: 6,
        description: 'Insurer issues policy certificate to client',
        requireDocumentsComplete: true,
        defaultFollowUpSuggestion: 'Deliver policy documents to client',
        isActive: true,
      },
      {
        id: 'ws15', caseTypeId: 'wt2', name: 'Close Case', order: 7,
        description: 'Policy issued. Case complete.',
        requireDocumentsComplete: true,
        defaultFollowUpSuggestion: '',
        isActive: true,
      },
    ],
  },
  {
    id: 'wt3',
    caseType: 'Renewal',
    description: 'Annual renewal process for existing bonds and policies.',
    isActive: true,
    requiredDocuments: [
      {
        id: 'rd20', caseTypeId: 'wt3', name: 'Previous Policy / Bond',
        description: 'Copy of existing policy or bond certificate for renewal', required: true,
        acceptedFileTypes: ['PDF', 'JPG'], isActive: true,
        aiPrompt: `This is a performance bond certificate, bank guarantee, or insurance policy document for renewal purposes.

Extract the following:
- customerName: The INSURED / PRINCIPAL company name and registration number
- projectName: The project description or risk location as stated in the certificate
- caseType: Bond or insurance type (e.g. "Performance Bond", "Contractor All Risk", "Public Liability", "Workmen Compensation")
- amount: Contract value or sum insured (if stated)
- bondValue: The guaranteed / insured amount — the principal sum of the bond or policy
- expiryDate: The bond or policy EXPIRY DATE / Tarikh Tamat / validity end date
- notes: Certificate or policy number, issuing insurer or bank name`,
      },
      {
        id: 'rd21', caseTypeId: 'wt3', name: 'Updated Bank Statement',
        description: 'Latest 3 months bank statement if required by insurer', required: false,
        acceptedFileTypes: ['PDF'], isActive: true,
      },
    ],
    workflowSteps: [
      {
        id: 'ws19', caseTypeId: 'wt3', name: 'Send out for Quotation', order: 1,
        description: 'Send renewal quotation request to insurer(s) via AI-composed email',
        requireDocumentsComplete: false,
        defaultFollowUpSuggestion: 'Follow up with insurer on renewal quotation request',
        isActive: true,
        aiEmailEnabled: true,
      },
      {
        id: 'ws20', caseTypeId: 'wt3', name: 'Review Expiry', order: 2,
        description: 'Review expiry date and initiate renewal process with client',
        requireDocumentsComplete: false,
        defaultFollowUpSuggestion: 'Notify client of upcoming renewal',
        isActive: true,
      },
      {
        id: 'ws21', caseTypeId: 'wt3', name: 'Get Renewal Quote', order: 3,
        description: 'Obtain renewal quotation from current or alternative insurer',
        requireDocumentsComplete: false,
        defaultFollowUpSuggestion: 'Request renewal quotation from insurer',
        isActive: true,
      },
      {
        id: 'ws22', caseTypeId: 'wt3', name: 'Send to Customer', order: 4,
        description: 'Present renewal quotation to client for approval',
        requireDocumentsComplete: false,
        defaultFollowUpSuggestion: 'Follow up with client on renewal decision',
        isActive: true,
      },
      {
        id: 'ws23', caseTypeId: 'wt3', name: 'Confirm Renewal', order: 5,
        description: 'Client approves renewal and authorizes payment',
        requireDocumentsComplete: true,
        defaultFollowUpSuggestion: 'Confirm renewal approval and collect payment',
        isActive: true,
      },
      {
        id: 'ws24', caseTypeId: 'wt3', name: 'Process Renewal', order: 6,
        description: 'Submit renewal to insurer and obtain new certificate',
        requireDocumentsComplete: true,
        defaultFollowUpSuggestion: 'Deliver renewed policy documents to client',
        isActive: true,
      },
      {
        id: 'ws25', caseTypeId: 'wt3', name: 'Close Case', order: 7,
        description: 'Renewal complete. New certificate issued to client.',
        requireDocumentsComplete: true,
        defaultFollowUpSuggestion: '',
        isActive: true,
      },
    ],
  },
  {
    id: 'wt4',
    caseType: 'Bond Request',
    businessType: 'Sole Proprietor',
    description: 'Bond request workflow for sole proprietor (enterprise) applicants — from LOA receipt to bond issuance.',
    isActive: true,
    requiredDocuments: [
      // ── Step 1: Receive Letter of Award ──
      {
        id: 'rd43', caseTypeId: 'wt4', workflowStepId: 'ws39',
        name: 'Letter of Award (LOA)',
        description: 'SST or letter of award from the project owner confirming contract award', required: true,
        acceptedFileTypes: ['PDF', 'DOCX'], isActive: true,
        aiPrompt: `This is a Surat Setuju Terima (SST) / Letter of Award from a Malaysian government agency. Extract: customerName (contractor name + reg no), projectName (full works description), caseType (bond type in English), amount (contract value as number), bondValue (bond amount as number), workStartDate (YYYY-MM-DD), workEndDate (YYYY-MM-DD), dlpEndDate (explicit or workEndDate + 12m + 3m + 14d), bondValidUntil (explicit or dlpEndDate + 12m if ≤RM10M), sstNo (contract reference), issuingAgency (government body name). Return as JSON.`,
      },
      // ── Step 4: Collect Application Documents ──
      {
        id: 'rd40', caseTypeId: 'wt4', workflowStepId: 'ws42',
        name: 'Bond Application Form',
        description: 'Completed and signed bond application form', required: true,
        acceptedFileTypes: ['PDF', 'DOCX'], isActive: true,
      },
      {
        id: 'rd41', caseTypeId: 'wt4', workflowStepId: 'ws42',
        name: 'SSM Business Certificate (Form D / ROB)',
        description: 'Business registration certificate from Suruhanjaya Syarikat Malaysia', required: true,
        acceptedFileTypes: ['PDF', 'JPG', 'PNG'], isActive: true,
      },
      {
        id: 'rd42', caseTypeId: 'wt4', workflowStepId: 'ws42',
        name: "Proprietor's IC / MyKad",
        description: "Copy of sole proprietor's MyKad (front and back)", required: true,
        acceptedFileTypes: ['PDF', 'JPG', 'PNG'], isActive: true,
      },
      {
        id: 'rd43', caseTypeId: 'wt4', name: 'Contract / Award Letter',
        description: 'SST or letter of award from the project owner', required: true,
        acceptedFileTypes: ['PDF', 'DOCX'], isActive: true,
        aiPrompt: `This is a Surat Setuju Terima (SST) / Letter of Award / Contract Acceptance from a Malaysian government agency.

Extract the following fields and return as a single JSON object:

1. customerName
   The CONTRACTOR's full company name AND registration number
   Look for: company awarded the contract — "Enterprise", "Sdn. Bhd.", "Sdn Bhd", "Trading", "Resources"
   NOT the government agency or university
   Example: "MASAYU ENTERPRISE 198003027177 (000504744-H)"
   Example: "TNO RESOURCES (003356082-V)"

2. projectName
   The full project/works description exactly as written in the document
   Look for: "Kerja-Kerja", "Skop Kerja", "Perihal Kerja", or the bold heading after "Sebutharga Untuk"
   Copy the full text — do not shorten or summarise

3. caseType
   The type of bond or security required
   Look for: "Bon Pelaksanaan", "Wang Jaminan Perlaksanaan", "Jaminan Bank"
   Return in English: "Performance Bond" or "Bank Guarantee" or "Cash Deposit"

4. amount
   The total awarded contract value
   Look for: "Harga Kontrak", "Harga Sebutharga", "Harga Tender", "harga sebanyak Ringgit Malaysia"
   Return as number only e.g. 267740

5. bondValue
   The performance bond / deposit amount
   Look for: "Nilai Bon Pelaksanaan", "bon pelaksanaan...berjumlah", typically 5% of contract value
   Return as number only e.g. 13387

6. thirdPartyLiability
   The public liability insurance value
   Look for: "Polisi Insurans Tanggungan Awam", "Nilai Polisi" under Tanggungan Awam section
   Return as number only e.g. 100000

7. workStartDate
   The date work is allowed to begin / site possession date
   Look for: "Tarikh Mula Kerja", "Tarikh Milik Tapak", "tarikh mula kerja seperti yang disebutkan dalam Lampiran A"
   Return as YYYY-MM-DD

8. workEndDate
   The contract completion date
   Look for: "Tarikh Siap", "Tarikh Tamat Kerja", "Tarikh Siap untuk seluruh kerja-kerja", "Tarikh Siap Kerja"
   Return as YYYY-MM-DD

9. dlpEndDate
   The end date of the Defect Liability Period (DLP / Tempoh Tanggungan Kecacatan)

   STEP 1 — Look for an explicit date first:
   Check "Polisi Insurans Tanggungan Awam" -> "Tempoh Perlindungan" end date
   Check "Tempoh Sah Laku" under bond section for a stated end date
   If an explicit end date is found, use it directly.

   STEP 2 — If NO explicit end date is found, CALCULATE it:
   Formula: workEndDate + 12 months (DLP) + 3 months + 14 days

   Return as YYYY-MM-DD

10. workInsuranceValue
    The Contractors All Risk (CAR) / Works Insurance / Polisi Insurans Kerja policy value
    Look for: "Polisi Insurans Kerja", "Nilai Polisi" under Insurans Kerja section
    Usually equals the contract value
    Return as number only

11. sebuthargaNo
    The tender/quotation reference number
    Look for: "No. Sebutharga", "No. Tender"
    NOTE: Some JKR documents use "No. Kontrak" only — if there is no "No. Sebutharga" or
    "No. Tender", return null. Do NOT put the contract number here — that goes into sstNo
    Return as string e.g. "NETSS202600078" or null

12. sstNo
    The primary reference number for this contract/acceptance letter
    Look for in this order of priority:
    (a) "No. Surat Setuju Terima" e.g. "SST202600224"
    (b) "No. Kontrak" e.g. "JKR/WPP/Q/10/2026"
    (c) "Rujukan" / reference number at the top of the letter
    Return whichever is found first, as a string

13. issuingAgency
    The name of the government agency or university issuing this contract
    Return full name including abbreviation
    e.g. "Universiti Kebangsaan Malaysia (UKM)"
    e.g. "Jabatan Kerja Raya Wilayah Persekutuan Putrajaya (JKR WPP)"

14. latePenaltyRate
    The daily late completion penalty rate
    TYPE A: Fixed table — find the row matching the contract amount, return the daily rate as a number
    TYPE B: LAD Formula — if only formula stated e.g. "6.40% x Harga Kontrak / 365":
    Calculate: (percentage / 100) x amount / 365, round to 2 decimal places
    Return as number only

15. bondValidUntil
    The expiry date of the performance bond (Tempoh Sah Laku Bon Pelaksanaan)
    STEP 1 — explicit date from "Tempoh Sah Laku" under "Bon Pelaksanaan"
    STEP 2 — CALCULATE: amount <= RM10M: dlpEndDate + 12 months; amount > RM10M: dlpEndDate + 24 months
    Return as YYYY-MM-DD

16. dlpBreakdown
    { "dlpMonths": number, "bufferMonths": number, "bufferDays": number, "label": string }
    Default if not found: { "dlpMonths": 12, "bufferMonths": 3, "bufferDays": 14, "label": "12MONTHS + 3MONTHS + 14DAYS" }

Return this exact JSON structure:
{
  "customerName": string | null,
  "projectName": string | null,
  "caseType": string | null,
  "amount": number | null,
  "bondValue": number | null,
  "thirdPartyLiability": number | null,
  "workStartDate": string | null,
  "workEndDate": string | null,
  "dlpEndDate": string | null,
  "workInsuranceValue": number | null,
  "sebuthargaNo": string | null,
  "sstNo": string | null,
  "issuingAgency": string | null,
  "latePenaltyRate": number | null,
  "bondValidUntil": string | null,
  "dlpBreakdown": {
    "dlpMonths": number,
    "bufferMonths": number,
    "bufferDays": number,
    "label": string
  }
}`,
      },
      {
        id: 'rd44', caseTypeId: 'wt4', workflowStepId: 'ws42',
        name: 'Bank Statement',
        description: 'Latest 3 months personal or business bank statement', required: true,
        acceptedFileTypes: ['PDF'], isActive: true,
      },
      {
        id: 'rd45', caseTypeId: 'wt4', workflowStepId: 'ws42',
        name: 'Previous Bond / Policy',
        description: 'Copy of most recent bond or insurance certificate (if applicable)', required: false,
        acceptedFileTypes: ['PDF', 'JPG'], isActive: true,
      },
      {
        id: 'rd46', caseTypeId: 'wt4', workflowStepId: 'ws42',
        name: 'Business Profile',
        description: 'Business background, track record, and completed projects (optional but recommended for large bonds)', required: false,
        acceptedFileTypes: ['PDF', 'DOCX'], isActive: true,
      },
    ],
    workflowSteps: [
      {
        id: 'ws39', caseTypeId: 'wt4', name: 'Receive LOA', order: 1,
        description: 'Client submits Letter of Award (LOA). Verify project name, bond value, bond type, and proprietor details before proceeding.',
        requireDocumentsComplete: true,
        defaultFollowUpSuggestion: 'Verify LOA details and confirm bond requirements with client',
        isActive: true,
        slaDays: 2,
      },
      {
        id: 'ws40', caseTypeId: 'wt4', name: 'Request Quotation', order: 2,
        description: 'Send quotation requests to selected insurers with LOA and project details.',
        requireDocumentsComplete: false,
        defaultFollowUpSuggestion: 'Follow up with insurers for outstanding quotations',
        isActive: true,
        aiEmailEnabled: true,
        slaDays: 5,
      },
      {
        id: 'ws41', caseTypeId: 'wt4', name: 'Quote to Client', order: 3,
        description: 'Compare received quotations and present recommendation to client. Confirm preferred insurer before collecting documents.',
        requireDocumentsComplete: false,
        defaultFollowUpSuggestion: 'Follow up with client on preferred insurer selection',
        isActive: true,
        slaDays: 3,
      },
      {
        id: 'ws42', caseTypeId: 'wt4', name: 'Collect Documents', order: 4,
        description: 'Client confirmed insurer. Collect SSM certificate, proprietor IC, application form, bank statement, and any supporting documents.',
        requireDocumentsComplete: true,
        defaultFollowUpSuggestion: 'Chase client for outstanding application documents',
        isActive: true,
        slaDays: 7,
      },
      {
        id: 'ws43', caseTypeId: 'wt4', name: 'Confirm Payment', order: 5,
        description: 'Client settles premium payment. Confirm amount received and prepare final submission package.',
        requireDocumentsComplete: false,
        defaultFollowUpSuggestion: 'Confirm payment received and issue receipt to client',
        isActive: true,
        slaDays: 2,
      },
      {
        id: 'ws44', caseTypeId: 'wt4', name: 'Issue Bond', order: 6,
        description: 'Submit complete documentation to insurer. Follow up for bond certificate. Verify details on receipt.',
        requireDocumentsComplete: true,
        defaultFollowUpSuggestion: 'Follow up with insurer for bond certificate issuance',
        isActive: true,
        slaDays: 5,
      },
      {
        id: 'ws45', caseTypeId: 'wt4', name: 'Close Case', order: 7,
        description: 'Deliver bond certificate to client. Record acceptance date, bond expiry, and final insurer.',
        requireDocumentsComplete: true,
        defaultFollowUpSuggestion: 'Confirm client received bond certificate and record bond expiry date',
        isActive: true,
        slaDays: 1,
      },
    ],
  },
]

// ─── Inquiries ────────────────────────────────────────────────────────────────

export const mockInquiries: Inquiry[] = [
  {
    id: 'inq1',
    inquiryTitle: 'Performance Bond — Projek Pembinaan Hospital Besar',
    customerId: 'cust1',
    customerName: 'Bina Perkasa Sdn Bhd',
    contactId: 'con1',
    contactName: 'Razif Harun',
    inquiryType: 'Bond Request',
    roughAmount: 450000,
    status: 'Quotation Received',
    assignedPerson: 'Ahmad Farid',
    notes: 'Client needs bond for a government hospital construction project. Deadline for submission is end of month.',
    createdAt: '2026-05-10T09:00:00Z',
    updatedAt: '2026-05-18T14:00:00Z',
    convertedToCase: false,
  },
  {
    id: 'inq2',
    inquiryTitle: 'Advance Payment Bond — Taman Perumahan Mutiara Fasa 4',
    customerId: 'cust4',
    customerName: 'Mutiara Permai Sdn Bhd',
    contactId: 'con7',
    contactName: 'Hafizah Mohd',
    inquiryType: 'Bond Request',
    roughAmount: 800000,
    status: 'Quotation Requested',
    assignedPerson: 'Ahmad Farid',
    notes: 'Large advance payment bond for Phase 4 residential development. Three insurers being approached.',
    createdAt: '2026-05-12T10:00:00Z',
    updatedAt: '2026-05-19T09:00:00Z',
    convertedToCase: false,
  },
  {
    id: 'inq3',
    inquiryTitle: 'Fidelity Bond — IT Department Renewal Check',
    customerId: 'cust3',
    customerName: 'Teknologi Canggih Sdn Bhd',
    contactId: 'con5',
    contactName: 'Sarah Tan',
    inquiryType: 'Market Checking',
    roughAmount: 75000,
    status: 'Customer Reviewing',
    assignedPerson: 'David Lim',
    notes: 'Annual market check for fidelity bond. Two competitive quotes received. Client comparing options.',
    createdAt: '2026-05-08T11:00:00Z',
    updatedAt: '2026-05-20T10:00:00Z',
    convertedToCase: false,
  },
  {
    id: 'inq4',
    inquiryTitle: 'Customs Bond — Import Duty Coverage',
    customerId: 'cust2',
    customerName: 'Maju Jaya Trading Sdn Bhd',
    contactId: 'con3',
    contactName: 'Lee Chee Keong',
    inquiryType: 'Renewal',
    roughAmount: 90000,
    status: 'Gathering Info',
    assignedPerson: 'Nurul Ain',
    notes: 'Client requesting renewal information. Awaiting latest financial statements before approaching insurers.',
    createdAt: '2026-05-15T08:00:00Z',
    updatedAt: '2026-05-15T08:00:00Z',
    convertedToCase: false,
  },
  {
    id: 'inq5',
    inquiryTitle: 'Workers Compensation — Logistics Fleet Expansion',
    customerId: 'cust5',
    customerName: 'Prisma Logistics Sdn Bhd',
    contactId: 'con9',
    contactName: 'Kevin Wong',
    inquiryType: 'Insurance Request',
    roughAmount: 30000,
    status: 'Qualified',
    assignedPerson: 'Nurul Ain',
    notes: 'Client approved Tokio Marine quote. Ready to proceed to case creation for issuance.',
    createdAt: '2026-05-05T09:00:00Z',
    updatedAt: '2026-05-21T11:00:00Z',
    convertedToCase: false,
  },
  {
    id: 'inq6',
    inquiryTitle: 'Immigration Bond — Production Workers',
    customerId: 'cust4',
    customerName: 'Mutiara Permai Sdn Bhd',
    contactId: 'con7',
    contactName: 'Hafizah Mohd',
    inquiryType: 'Bond Request',
    roughAmount: 40000,
    status: 'Lost',
    assignedPerson: 'David Lim',
    notes: 'Client decided to use their existing insurer directly. No conversion.',
    createdAt: '2026-05-01T08:00:00Z',
    updatedAt: '2026-05-14T16:00:00Z',
    convertedToCase: false,
  },
]

export const mockInquiryQuotations: InquiryQuotation[] = [
  // inq1 — Quotation Received (3 insurers)
  {
    id: 'iqt1',
    inquiryId: 'inq1',
    providerName: 'Allianz Malaysia',
    quotationAmount: 5625,
    requestedDate: '2026-05-12',
    receivedDate: '2026-05-15',
    status: 'Quoted',
    notes: 'Rate at 1.25%. Premium includes stamp duty.',
  },
  {
    id: 'iqt2',
    inquiryId: 'inq1',
    providerName: 'Zurich Insurance',
    quotationAmount: 5400,
    requestedDate: '2026-05-12',
    receivedDate: '2026-05-16',
    status: 'Under Review',
    notes: 'Rate at 1.2%. Competitive. Awaiting client review.',
  },
  {
    id: 'iqt3',
    inquiryId: 'inq1',
    providerName: 'AIG Malaysia',
    quotationAmount: 0,
    requestedDate: '2026-05-12',
    status: 'No Response',
    notes: 'No reply after 3 days. Will chase if needed.',
  },
  // inq2 — Quotation Requested
  {
    id: 'iqt4',
    inquiryId: 'inq2',
    providerName: 'Tokio Marine',
    quotationAmount: 0,
    requestedDate: '2026-05-19',
    status: 'Pending',
    notes: 'Sent application. Awaiting response.',
  },
  {
    id: 'iqt5',
    inquiryId: 'inq2',
    providerName: 'MSIG Malaysia',
    quotationAmount: 0,
    requestedDate: '2026-05-19',
    status: 'Pending',
    notes: '',
  },
  // inq3 — Customer Reviewing (2 quotes received)
  {
    id: 'iqt6',
    inquiryId: 'inq3',
    providerName: 'Etiqa Insurance',
    quotationAmount: 875,
    requestedDate: '2026-05-10',
    receivedDate: '2026-05-13',
    status: 'Quoted',
    notes: 'Annual premium RM 875. Client comparing.',
  },
  {
    id: 'iqt7',
    inquiryId: 'inq3',
    providerName: 'Great Eastern',
    quotationAmount: 920,
    requestedDate: '2026-05-10',
    receivedDate: '2026-05-14',
    status: 'Quoted',
    notes: 'Annual premium RM 920. Slightly higher but includes personal accident rider.',
  },
  // inq5 — Qualified (one approved)
  {
    id: 'iqt8',
    inquiryId: 'inq5',
    providerName: 'Tokio Marine',
    quotationAmount: 1800,
    requestedDate: '2026-05-08',
    receivedDate: '2026-05-10',
    status: 'Quoted',
    notes: 'Client approved. Ready to proceed.',
  },
  {
    id: 'iqt9',
    inquiryId: 'inq5',
    providerName: 'Berjaya Sompo',
    quotationAmount: 2100,
    requestedDate: '2026-05-08',
    receivedDate: '2026-05-11',
    status: 'Rejected',
    notes: 'Client found Tokio Marine more competitive.',
  },
  // inq6 — Lost
  {
    id: 'iqt10',
    inquiryId: 'inq6',
    providerName: 'Allianz Malaysia',
    quotationAmount: 1200,
    requestedDate: '2026-05-03',
    receivedDate: '2026-05-06',
    status: 'Rejected',
    notes: 'Client went with own insurer.',
  },
]

export const mockInquiryNotes: InquiryNote[] = [
  {
    id: 'iqn1',
    inquiryId: 'inq1',
    content: 'Called Razif. He confirmed the bond value is RM 450,000 and deadline is 30 May. Will prepare application for Allianz and Zurich.',
    createdAt: '2026-05-10T09:30:00Z',
    createdBy: 'Ahmad Farid',
  },
  {
    id: 'iqn2',
    inquiryId: 'inq1',
    content: 'Received Allianz quote at RM 5,625 (1.25%). Zurich came back at RM 5,400 (1.2%). AIG no response. Presenting both to client tomorrow.',
    createdAt: '2026-05-17T11:00:00Z',
    createdBy: 'Ahmad Farid',
  },
  {
    id: 'iqn3',
    inquiryId: 'inq3',
    content: 'Sarah confirmed they want to compare both Etiqa and Great Eastern quotes. Will decide by 22 May.',
    createdAt: '2026-05-15T10:00:00Z',
    createdBy: 'David Lim',
  },
  {
    id: 'iqn4',
    inquiryId: 'inq5',
    content: 'Kevin confirmed Tokio Marine at RM 1,800. Instructed to proceed. Will convert to case for issuance.',
    createdAt: '2026-05-21T11:00:00Z',
    createdBy: 'Nurul Ain',
  },
]

export const mockInquiryDocuments: InquiryDocument[] = [
  {
    id: 'iqdoc1',
    inquiryId: 'inq1',
    fileName: 'Contract_Hospital_Besar.pdf',
    fileSize: 245000,
    fileType: 'application/pdf',
    documentType: 'Contract / Award Letter',
    uploadedBy: 'Ahmad Farid',
    uploadedAt: '2026-05-10T09:15:00Z',
  },
  {
    id: 'iqdoc2',
    inquiryId: 'inq1',
    fileName: 'BinaPerkasa_FinancialStmt_2025.pdf',
    fileSize: 380000,
    fileType: 'application/pdf',
    documentType: 'Financial Statement',
    uploadedBy: 'Ahmad Farid',
    uploadedAt: '2026-05-11T10:00:00Z',
  },
  {
    id: 'iqdoc3',
    inquiryId: 'inq5',
    fileName: 'WorkersList_Logistics.xlsx',
    fileSize: 52000,
    fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    documentType: 'Supporting Document',
    uploadedBy: 'Nurul Ain',
    uploadedAt: '2026-05-08T09:30:00Z',
  },
]
