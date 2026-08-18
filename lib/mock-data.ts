import type {
  Customer, Contact, Case, CaseNote, FollowUp, PicUser, User,
  CaseFile, ActivityLog, SettingsItem, WorkflowTemplate,
  Inquiry, InquiryQuotation, InquiryNote, InquiryDocument,
  Product, ProductPackage, SubmissionLetterTemplate,
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
    contactType: 'Director', isPrimary: true, notes: '',
  },
  {
    id: 'con2', customerId: 'cust1', contactName: 'Faridah Zain',
    role: 'Finance Manager', phone: '012-3456780', email: 'faridah@binaperkasa.com',
    contactType: 'Finance', isPrimary: false, notes: '',
  },
  // Maju Jaya (cust2)
  {
    id: 'con3', customerId: 'cust2', contactName: 'Lee Chee Keong',
    role: 'Owner', phone: '016-7891234', email: 'cheekeong@majujaya.com',
    contactType: 'Owner', isPrimary: true, notes: '',
  },
  {
    id: 'con4', customerId: 'cust2', contactName: 'Michelle Tan',
    role: 'Operations', phone: '016-7891235', email: 'michelle@majujaya.com',
    contactType: 'Operations', isPrimary: false, notes: '',
  },
  // Teknologi Canggih (cust3)
  {
    id: 'con5', customerId: 'cust3', contactName: 'Sarah Tan',
    role: 'Operations Manager', phone: '011-23456789', email: 'sarah@tekcanggih.com',
    contactType: 'Manager', isPrimary: true, notes: '',
  },
  {
    id: 'con6', customerId: 'cust3', contactName: 'James Ng',
    role: 'IT Director', phone: '011-23456780', email: 'james@tekcanggih.com',
    contactType: 'Director', isPrimary: false, notes: '',
  },
  // Mutiara Permai (cust4)
  {
    id: 'con7', customerId: 'cust4', contactName: 'Hafizah Mohd',
    role: 'Director', phone: '019-9876543', email: 'hafizah@mutiarapermai.com',
    contactType: 'Director', isPrimary: true, notes: '',
  },
  {
    id: 'con8', customerId: 'cust4', contactName: 'Azrul Nizam',
    role: 'Project Manager', phone: '019-9876544', email: 'azrul@mutiarapermai.com',
    contactType: 'Manager', isPrimary: false, notes: '',
  },
  // Prisma Logistics (cust5)
  {
    id: 'con9', customerId: 'cust5', contactName: 'Kevin Wong',
    role: 'Managing Director', phone: '017-5551234', email: 'kevin@prismalogistics.com',
    contactType: 'Director', isPrimary: true, notes: '',
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
    currentStatus: 'In Progress',
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
    currentStatus: 'In Progress',
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
    currentStatus: 'In Progress',
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
    currentStatus: 'In Progress',
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
    currentStatus: 'Created',
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
    currentStatus: 'In Progress',
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
    currentStatus: 'Created',
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
    currentStatus: 'Done',
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
  { id: 'sct1', name: 'Bond Workflow', isActive: true },
  { id: 'sct2', name: 'Simple Policy Workflow', isActive: true },
  { id: 'sct3', name: 'Project Insurance Workflow', isActive: true },
  { id: 'sct4', name: 'Claim Workflow', isActive: true },
  { id: 'sct5', name: 'Renewal Workflow', isActive: true },
  { id: 'sct6', name: 'Endorsement Workflow', isActive: true },
  { id: 'sct7', name: 'Servicing Workflow', isActive: true },
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

// ─── Product Master ───────────────────────────────────────────────────────────

export const mockProducts: Product[] = [
  // ── Bonds ──
  { id: 'prod1', name: 'Performance Bond', category: 'Bond', description: 'Guarantees contractor performance per contract terms', isActive: true },
  { id: 'prod2', name: 'Tender Bond / Bid Bond', category: 'Bond', description: 'Required during tender process; forfeited if contractor withdraws after award', isActive: true },
  { id: 'prod3', name: 'Advance Payment Bond', category: 'Bond', description: 'Guarantees repayment of advance payment if not utilised by contractor', isActive: true },
  { id: 'prod4', name: 'Retention Bond', category: 'Bond', description: 'Replaces cash retention withheld by employer; released upon DLP end', isActive: true },
  { id: 'prod5', name: 'Customs Bond', category: 'Bond', description: 'Required by Royal Malaysian Customs for duty-deferred imports', isActive: true },
  { id: 'prod6', name: 'Immigration Bond', category: 'Bond', description: 'Required for foreign worker visa and permit applications (PLKS/PATI)', isActive: true },
  { id: 'prod7', name: 'Fidelity Guarantee', category: 'Bond', description: 'Covers employer against employee dishonesty, fraud, or defalcation', isActive: true },
  // ── Insurance ──
  { id: 'prod8', name: 'Workmen Compensation (WC)', category: 'Insurance', description: 'Covers work-related injury, illness, disability, and death for workers', isActive: true },
  { id: 'prod9', name: 'Third Party Liability (TPL)', category: 'Insurance', description: 'Covers legal liability to third parties for bodily injury or property damage', isActive: true },
  { id: 'prod10', name: 'Contractor All Risk (CAR)', category: 'Insurance', description: 'All-risk cover for contract works in progress and third party liability during construction', isActive: true },
  { id: 'prod11', name: 'Contractor Plant & Machinery (CPM)', category: 'Insurance', description: 'Covers sudden accidental damage to contractor plant and equipment on-site', isActive: true },
  { id: 'prod12', name: 'Fire Insurance', category: 'Insurance', description: 'Covers property against fire, lightning, and related perils', isActive: true },
  { id: 'prod13', name: 'Marine Cargo Insurance', category: 'Insurance', description: 'Covers goods during transit by sea, air, or land', isActive: true },
]

export const mockProductPackages: ProductPackage[] = [
  { id: 'pkg1', name: 'Performance Bond Only', description: 'Standalone performance bond for government or private contracts', productIds: ['prod1'], isActive: true },
  { id: 'pkg2', name: 'Tender Bond Only', description: 'Standalone tender / bid bond for submission stage', productIds: ['prod2'], isActive: true },
  { id: 'pkg3', name: 'Advance Payment Bond Only', description: 'Standalone advance payment bond', productIds: ['prod3'], isActive: true },
  { id: 'pkg4', name: 'WC Only', description: 'Workmen compensation insurance only', productIds: ['prod8'], isActive: true },
  { id: 'pkg5', name: 'TPL Only', description: 'Third party liability insurance only', productIds: ['prod9'], isActive: true },
  { id: 'pkg6', name: 'WC + TPL', description: 'Workers compensation and third party liability package', productIds: ['prod8', 'prod9'], isActive: true },
  { id: 'pkg7', name: 'Performance Bond + WC + TPL', description: 'Full government construction package — bond plus insurance cover', productIds: ['prod1', 'prod8', 'prod9'], isActive: true },
  { id: 'pkg8', name: 'CAR Package', description: 'Contractor All Risk with Third Party Liability', productIds: ['prod10', 'prod9'], isActive: true },
  { id: 'pkg9', name: 'Custom', description: 'Select products manually — for non-standard combinations', productIds: [], isActive: true },
]

// ─── Submission Letter Templates ─────────────────────────────────────────────

export const mockSubmissionLetterTemplates: SubmissionLetterTemplate[] = [
  {
    id: 'slt1',
    name: 'Performance Bond — Standard',
    isActive: true,
    subjectLine: 'REQUISITION OF PERFORMANCE BOND (INSURANCE GUARANTEE) OF {{bondAmount}}',
    letterBody: `Dear Sir / Mdm

The above Performance Bond (Insurance Guarantee) refers.

We submit herewith the following documents for your processing.

{{docList}}

Kindly acknowledge the above documents by signing & returning the duplicate of this letter.

Thank you.

Yours faithfully`,
    docItems: [
      { id: 'di1', labelInForm: 'Proposal Form', textTemplate: 'Duly completed & Executed Contract Guarantee proposal form', defaultChecked: true },
      { id: 'di2', labelInForm: 'Quotation for Performance Bond', textTemplate: 'Quotation for Performance Bond', defaultChecked: true },
      { id: 'di3', labelInForm: 'Letter of Indemnity (Green)', textTemplate: 'Letter of Indemnity (Green) – {{contractor}}', defaultChecked: true },
      { id: 'di4', labelInForm: 'Letter of Indemnity (White) – Director', textTemplate: 'Letter of Indemnity (White), Financial Statement & Copy of NRIC – {{directorName}}', defaultChecked: true, subFieldType: 'director' },
      { id: 'di5', labelInForm: '3rd Party Guarantor LOI (White)', textTemplate: '3RD Party Guarantor - Letter of Indemnity (White), Financial Statement & Copy of NRIC – {{guarantorName}}', defaultChecked: true, subFieldType: 'guarantor' },
      { id: 'di6', labelInForm: 'SSM Complete Set', textTemplate: 'SSM Complete set – {{contractor}}', defaultChecked: true },
      { id: 'di7', labelInForm: 'Bank Statement', textTemplate: '{{contractor}} – {{bankName}} Statement – {{statementPeriod}}', defaultChecked: true, subFieldType: 'bank' },
      { id: 'di8', labelInForm: 'CIDB Certificates', textTemplate: '{{contractor}} – CIDB Perakuan Pendaftaran, Sijil Perolehan Kerja Kerajaan, Bahagian Pembangunan Kontraktor Dan Usahawan, Sijil Akuan Pendaftaran Syarikat Bumiputra & Sijil Akuan Pendaftaran Syarikat', defaultChecked: true },
      { id: 'di9', labelInForm: 'Company Profile', textTemplate: '{{contractor}} – Company Profile', defaultChecked: true },
      { id: 'di10', labelInForm: 'Letter of Award', textTemplate: 'Letter of Award – {{principal}} to {{contractor}}', defaultChecked: true },
      { id: 'di11', labelInForm: 'Payment of Premium', textTemplate: 'Payment of Premium {{premiumAmount}}', defaultChecked: true, subFieldType: 'premium' },
    ],
  },
]

// ─── Workflow Templates ───────────────────────────────────────────────────────

export const mockWorkflowTemplates: WorkflowTemplate[] = [

  // ─── 1. Bond Workflow — Sdn. Bhd. / Company ────────────────────────────────
  {
    id: 'wt_bond',
    caseType: 'Bond Workflow',
    businessType: 'Sdn. Bhd.',
    description: 'Full bond placement workflow for company applicants — from LOA receipt to bond issuance.',
    isActive: true,
    requiredDocuments: [
      {
        id: 'wt_bond_d1', caseTypeId: 'wt_bond', workflowStepId: 'wt_bond_s1',
        name: 'Letter of Award (LOA)',
        description: 'Surat Setuju Terima (SST) or Letter of Award from the project owner confirming contract award',
        required: true, acceptedFileTypes: ['PDF', 'DOCX'], isActive: true,
        aiPrompt: `This is a Surat Setuju Terima (SST) / Letter of Award / Contract Acceptance from a Malaysian government agency.

Extract the following fields and return as a single JSON object:

1. customerName
   The CONTRACTOR's full company name AND registration number
   Look for: company awarded the contract — "Enterprise", "Sdn. Bhd.", "Sdn Bhd", "Trading", "Resources"
   NOT the government agency or university
   Example: "MASAYU ENTERPRISE 198003027177 (000504744-H)"

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
   Look for: "Tarikh Mula Kerja", "Tarikh Milik Tapak"
   Return as YYYY-MM-DD

8. workEndDate
   Look for: "Tarikh Siap", "Tarikh Tamat Kerja", "Tarikh Siap Kerja"
   Return as YYYY-MM-DD

9. dlpEndDate
   STEP 1 — Look for explicit date under "Tempoh Sah Laku" or "Tempoh Perlindungan"
   STEP 2 — If not found, CALCULATE: workEndDate + 12 months + 3 months + 14 days
   Return as YYYY-MM-DD

10. workInsuranceValue
    Contractors All Risk (CAR) / Polisi Insurans Kerja policy value. Usually equals contract value.
    Return as number only

11. sebuthargaNo
    Look for "No. Sebutharga", "No. Tender". Return null if not found.

12. sstNo
    Priority: (a) No. Surat Setuju Terima (b) No. Kontrak (c) Rujukan
    Return as string

13. issuingAgency
    The government agency or university issuing this contract (NOT the contractor)

14. latePenaltyRate
    Daily late completion penalty. Return as number only.

15. bondValidUntil
    From "Tempoh Sah Laku" under "Bon Pelaksanaan".
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
      { id: 'wt_bond_d2', caseTypeId: 'wt_bond', workflowStepId: 'wt_bond_s4', name: 'Company Profile', description: 'Company background, business overview, and track record (minimum 2 pages)', required: true, acceptedFileTypes: ['PDF', 'DOCX'], isActive: true },
      { id: 'wt_bond_d3', caseTypeId: 'wt_bond', workflowStepId: 'wt_bond_s4', name: 'SSM Certificate', description: 'Companies Commission of Malaysia (SSM) registration certificate — Form 9, 13, 24, 49', required: true, acceptedFileTypes: ['PDF', 'JPG', 'PNG'], isActive: true },
      { id: 'wt_bond_d4', caseTypeId: 'wt_bond', workflowStepId: 'wt_bond_s4', name: 'Latest Audited Financial Statement', description: 'Audited accounts for the last 2 financial years (signed by auditor)', required: true, acceptedFileTypes: ['PDF', 'XLSX'], isActive: true },
      { id: 'wt_bond_d5', caseTypeId: 'wt_bond', workflowStepId: 'wt_bond_s4', name: 'Bond Application Form', description: 'Completed and signed bond application form from insurer (obtain from insurer or company letterhead)', required: true, acceptedFileTypes: ['PDF', 'DOCX'], isActive: true },
      { id: 'wt_bond_d6', caseTypeId: 'wt_bond', workflowStepId: 'wt_bond_s4', name: "Director's IC / MyKad", description: "Copy of MyKad (front and back) for all directors listed in SSM", required: true, acceptedFileTypes: ['PDF', 'JPG', 'PNG'], isActive: true },
      { id: 'wt_bond_d7', caseTypeId: 'wt_bond', workflowStepId: 'wt_bond_s4', name: 'Authorization Letter', description: 'Company authorization letter for bond application, signed by director and company stamp', required: true, acceptedFileTypes: ['PDF', 'DOCX'], isActive: true },
      { id: 'wt_bond_d8', caseTypeId: 'wt_bond', workflowStepId: 'wt_bond_s4', name: 'Bank Statement', description: 'Latest 3 months company bank statement (all accounts)', required: false, acceptedFileTypes: ['PDF'], isActive: true },
    ],
    workflowSteps: [
      { id: 'wt_bond_s1', caseTypeId: 'wt_bond', name: 'Receive LOA', order: 1, description: 'Client submits Letter of Award (LOA). Verify project name, bond value, bond type, and principal entity before proceeding. AI-scan the LOA to extract key details.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Verify LOA details and confirm bond requirements with client', isActive: true, slaDays: 2 },
      { id: 'wt_bond_s2', caseTypeId: 'wt_bond', name: 'Request Quotation', order: 2, description: 'Send quotation requests to selected insurers with LOA and project details. Use the AI email panel to contact multiple insurers efficiently.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Follow up with insurers for outstanding quotations', isActive: true, aiEmailEnabled: true, slaDays: 5 },
      { id: 'wt_bond_s3', caseTypeId: 'wt_bond', name: 'Quote to Client', order: 3, description: 'Compare received quotations on premium rate, terms, and insurer reputation. Prepare a summary and present your recommendation to the client. Confirm preferred insurer before proceeding.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Follow up with client on preferred insurer selection', isActive: true, slaDays: 3 },
      { id: 'wt_bond_s4', caseTypeId: 'wt_bond', name: 'Collect Documents', order: 4, description: 'Client has confirmed insurer selection. Collect all required documents: company profile, SSM, director IC, authorization letter, financial statements, and bond application form.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Chase client for outstanding application documents', isActive: true, slaDays: 7 },
      { id: 'wt_bond_s5', caseTypeId: 'wt_bond', name: 'Confirm Payment', order: 5, description: 'Client settles premium payment. Confirm amount received, issue official receipt, and prepare final submission package for insurer.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Confirm payment received and issue receipt to client', isActive: true, slaDays: 2 },
      { id: 'wt_bond_s6', caseTypeId: 'wt_bond', name: 'Issue Bond', order: 6, description: 'Submit complete documentation to insurer. Follow up for bond certificate. On receipt, verify principal name, sum insured, and bond validity period match the LOA.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Follow up with insurer for bond certificate issuance', isActive: true, slaDays: 5 },
      { id: 'wt_bond_s7', caseTypeId: 'wt_bond', name: 'Close Case', order: 7, description: 'Deliver bond certificate to client. Record acceptance date, bond expiry, and final insurer. Set renewal reminder 90 days before bond expiry.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Confirm client received bond certificate and record bond expiry date', isActive: true, slaDays: 1 },
    ],
  },

  // ─── 1b. Bond Workflow — Sole Proprietor ────────────────────────────────────
  {
    id: 'wt_bond_sp',
    caseType: 'Bond Workflow',
    businessType: 'Sole Proprietor',
    description: 'Bond placement workflow for sole proprietor (enterprise) applicants.',
    isActive: true,
    requiredDocuments: [
      {
        id: 'wt_bond_sp_d1', caseTypeId: 'wt_bond_sp', workflowStepId: 'wt_bond_sp_s1',
        name: 'Letter of Award (LOA)',
        description: 'SST or letter of award from the project owner confirming contract award', required: true,
        acceptedFileTypes: ['PDF', 'DOCX'], isActive: true,
        aiPrompt: `This is a Surat Setuju Terima (SST) / Letter of Award from a Malaysian government agency. Extract: customerName (contractor name + reg no), projectName (full works description), caseType (bond type in English), amount (contract value as number), bondValue (bond amount as number), workStartDate (YYYY-MM-DD), workEndDate (YYYY-MM-DD), dlpEndDate (explicit or workEndDate + 12m + 3m + 14d), bondValidUntil (explicit or dlpEndDate + 12m if ≤RM10M), sstNo (contract reference), issuingAgency (government body name). Return as JSON.`,
      },
      { id: 'wt_bond_sp_d2', caseTypeId: 'wt_bond_sp', workflowStepId: 'wt_bond_sp_s4', name: 'Bond Application Form', description: 'Completed and signed bond application form', required: true, acceptedFileTypes: ['PDF', 'DOCX'], isActive: true },
      { id: 'wt_bond_sp_d3', caseTypeId: 'wt_bond_sp', workflowStepId: 'wt_bond_sp_s4', name: 'SSM Business Certificate (Form D / ROB)', description: 'Business registration certificate from Suruhanjaya Syarikat Malaysia', required: true, acceptedFileTypes: ['PDF', 'JPG', 'PNG'], isActive: true },
      { id: 'wt_bond_sp_d4', caseTypeId: 'wt_bond_sp', workflowStepId: 'wt_bond_sp_s4', name: "Proprietor's IC / MyKad", description: "Copy of sole proprietor's MyKad (front and back)", required: true, acceptedFileTypes: ['PDF', 'JPG', 'PNG'], isActive: true },
      { id: 'wt_bond_sp_d5', caseTypeId: 'wt_bond_sp', workflowStepId: 'wt_bond_sp_s4', name: 'Bank Statement', description: 'Latest 3 months personal or business bank statement', required: true, acceptedFileTypes: ['PDF'], isActive: true },
      { id: 'wt_bond_sp_d6', caseTypeId: 'wt_bond_sp', workflowStepId: 'wt_bond_sp_s4', name: 'Previous Bond / Policy', description: 'Copy of most recent bond or insurance certificate (if applicable)', required: false, acceptedFileTypes: ['PDF', 'JPG'], isActive: true },
      { id: 'wt_bond_sp_d7', caseTypeId: 'wt_bond_sp', workflowStepId: 'wt_bond_sp_s4', name: 'Business Profile', description: 'Business background, track record, and completed projects (recommended for large bonds)', required: false, acceptedFileTypes: ['PDF', 'DOCX'], isActive: true },
    ],
    workflowSteps: [
      { id: 'wt_bond_sp_s1', caseTypeId: 'wt_bond_sp', name: 'Receive LOA', order: 1, description: 'Client submits Letter of Award (LOA). Verify project name, bond value, bond type, and proprietor details before proceeding.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Verify LOA details and confirm bond requirements with client', isActive: true, slaDays: 2 },
      { id: 'wt_bond_sp_s2', caseTypeId: 'wt_bond_sp', name: 'Request Quotation', order: 2, description: 'Send quotation requests to selected insurers with LOA and project details.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Follow up with insurers for outstanding quotations', isActive: true, aiEmailEnabled: true, slaDays: 5 },
      { id: 'wt_bond_sp_s3', caseTypeId: 'wt_bond_sp', name: 'Quote to Client', order: 3, description: 'Compare received quotations and present recommendation to client. Confirm preferred insurer before collecting documents.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Follow up with client on preferred insurer selection', isActive: true, slaDays: 3 },
      { id: 'wt_bond_sp_s4', caseTypeId: 'wt_bond_sp', name: 'Collect Documents', order: 4, description: 'Client confirmed insurer. Collect SSM certificate, proprietor IC, application form, bank statement, and any supporting documents.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Chase client for outstanding application documents', isActive: true, slaDays: 7 },
      { id: 'wt_bond_sp_s5', caseTypeId: 'wt_bond_sp', name: 'Confirm Payment', order: 5, description: 'Client settles premium payment. Confirm amount received and prepare final submission package.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Confirm payment received and issue receipt to client', isActive: true, slaDays: 2 },
      { id: 'wt_bond_sp_s6', caseTypeId: 'wt_bond_sp', name: 'Issue Bond', order: 6, description: 'Submit complete documentation to insurer. Follow up for bond certificate. Verify details on receipt.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Follow up with insurer for bond certificate issuance', isActive: true, slaDays: 5 },
      { id: 'wt_bond_sp_s7', caseTypeId: 'wt_bond_sp', name: 'Close Case', order: 7, description: 'Deliver bond certificate to client. Record acceptance date, bond expiry, and final insurer.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Confirm client received bond certificate and record bond expiry date', isActive: true, slaDays: 1 },
    ],
  },

  // ─── 2. Simple Policy Workflow ───────────────────────────────────────────────
  {
    id: 'wt_simple',
    caseType: 'Simple Policy Workflow',
    description: 'For straightforward single-policy insurance products — WC, TPL, Fidelity Guarantee, Fire Insurance.',
    isActive: true,
    requiredDocuments: [
      { id: 'wt_simple_d1', caseTypeId: 'wt_simple', workflowStepId: 'wt_simple_s4', name: 'Application Form', description: 'Completed and signed insurance application form (obtain from insurer)', required: true, acceptedFileTypes: ['PDF', 'DOCX'], isActive: true },
      { id: 'wt_simple_d2', caseTypeId: 'wt_simple', workflowStepId: 'wt_simple_s4', name: 'IC / Passport (Director or Owner)', description: "Copy of Director's or Owner's MyKad or Passport (front and back)", required: true, acceptedFileTypes: ['PDF', 'JPG', 'PNG'], isActive: true },
      { id: 'wt_simple_d3', caseTypeId: 'wt_simple', workflowStepId: 'wt_simple_s4', name: 'Supporting Documents', description: 'Additional documents specific to the policy type (e.g. workers list for WC, site plan for TPL)', required: false, acceptedFileTypes: ['PDF', 'DOCX', 'XLSX', 'JPG'], isActive: true },
    ],
    workflowSteps: [
      { id: 'wt_simple_s1', caseTypeId: 'wt_simple', name: 'Understand Requirements', order: 1, description: 'Discuss insurance requirements with client. Confirm coverage type, scope, period, and sum insured. Clarify if this is standalone or part of a project.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Contact client to understand insurance requirements and coverage scope', isActive: true, slaDays: 2 },
      { id: 'wt_simple_s2', caseTypeId: 'wt_simple', name: 'Request Quotation', order: 2, description: 'Send quotation requests to suitable insurers with key risk details and coverage requirements.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Follow up with insurers for outstanding quotations', isActive: true, aiEmailEnabled: true, slaDays: 3 },
      { id: 'wt_simple_s3', caseTypeId: 'wt_simple', name: 'Present Quote to Client', order: 3, description: 'Present quotation options to client. Explain coverage, exclusions, and premium. Make a clear recommendation.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Follow up with client on insurance quotation decision', isActive: true, slaDays: 2 },
      { id: 'wt_simple_s4', caseTypeId: 'wt_simple', name: 'Collect Documents', order: 4, description: 'Client confirmed insurer. Collect completed application form and all required supporting documents.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Chase client for outstanding application documents', isActive: true, slaDays: 5 },
      { id: 'wt_simple_s5', caseTypeId: 'wt_simple', name: 'Confirm Payment', order: 5, description: 'Client settles premium. Confirm receipt and prepare policy issuance request for insurer.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Confirm premium payment received and issue receipt', isActive: true, slaDays: 2 },
      { id: 'wt_simple_s6', caseTypeId: 'wt_simple', name: 'Issue Policy', order: 6, description: 'Insurer issues policy certificate. Verify policy number, coverage dates, sum insured, and insured name on receipt.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Follow up with insurer for policy certificate issuance', isActive: true, slaDays: 3 },
      { id: 'wt_simple_s7', caseTypeId: 'wt_simple', name: 'Close Case', order: 7, description: 'Deliver policy documents to client. Record policy number, expiry date, and set renewal reminder 60 days before expiry.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Confirm client received policy documents and record policy expiry date', isActive: true, slaDays: 1 },
    ],
  },

  // ─── 3. Project Insurance Workflow ──────────────────────────────────────────
  {
    id: 'wt_project',
    caseType: 'Project Insurance Workflow',
    description: 'For construction project insurance packages — WC + TPL, CAR + TPL, or multi-policy combinations tied to a contract or project.',
    isActive: true,
    requiredDocuments: [
      { id: 'wt_project_d1', caseTypeId: 'wt_project', workflowStepId: 'wt_project_s1', name: 'Contract / Award Letter', description: 'Contract or letter of award showing project value, scope, and duration', required: true, acceptedFileTypes: ['PDF', 'DOCX'], isActive: true },
      { id: 'wt_project_d2', caseTypeId: 'wt_project', workflowStepId: 'wt_project_s5', name: 'Company Profile', description: 'Company background and track record for project insurance submission', required: true, acceptedFileTypes: ['PDF', 'DOCX'], isActive: true },
      { id: 'wt_project_d3', caseTypeId: 'wt_project', workflowStepId: 'wt_project_s5', name: 'SSM Certificate', description: 'SSM registration certificate (Form 9, 13, 24, 49)', required: true, acceptedFileTypes: ['PDF', 'JPG', 'PNG'], isActive: true },
      { id: 'wt_project_d4', caseTypeId: 'wt_project', workflowStepId: 'wt_project_s5', name: "Director's IC / MyKad", description: "MyKad copies for all directors listed in SSM", required: true, acceptedFileTypes: ['PDF', 'JPG', 'PNG'], isActive: true },
      { id: 'wt_project_d5', caseTypeId: 'wt_project', workflowStepId: 'wt_project_s5', name: 'Application Forms (All Policies)', description: 'Completed and signed application forms for each insurance policy being placed', required: true, acceptedFileTypes: ['PDF', 'DOCX'], isActive: true },
      { id: 'wt_project_d6', caseTypeId: 'wt_project', workflowStepId: 'wt_project_s5', name: 'Workers List (for WC)', description: 'Full list of workers including names, IC numbers, job scope, and monthly wages', required: false, acceptedFileTypes: ['PDF', 'XLSX', 'DOCX'], isActive: true },
      { id: 'wt_project_d7', caseTypeId: 'wt_project', workflowStepId: 'wt_project_s5', name: 'Site Plan / Risk Description', description: 'Site layout or written risk description — location, access, surrounding hazards', required: false, acceptedFileTypes: ['PDF', 'JPG', 'PNG'], isActive: true },
      { id: 'wt_project_d8', caseTypeId: 'wt_project', workflowStepId: 'wt_project_s5', name: 'Bank Statement', description: 'Latest 3 months company bank statement', required: false, acceptedFileTypes: ['PDF'], isActive: true },
    ],
    workflowSteps: [
      { id: 'wt_project_s1', caseTypeId: 'wt_project', name: 'Understand Project Requirements', order: 1, description: 'Understand project scope, contract value, site details, worker count, and coverage requirements. Confirm which policies are needed (WC, TPL, CAR, etc.).', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Contact client to gather project details and coverage requirements', isActive: true, slaDays: 2 },
      { id: 'wt_project_s2', caseTypeId: 'wt_project', name: 'Assess Risk & Request Quotations', order: 2, description: 'Prepare risk summary and send quotation requests to selected insurers for all required policies. Use the AI email panel for efficiency.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Follow up with insurers for project insurance quotations', isActive: true, aiEmailEnabled: true, slaDays: 5 },
      { id: 'wt_project_s3', caseTypeId: 'wt_project', name: 'Present Insurance Proposal', order: 3, description: 'Compile all quotations into a proposal. Present coverage, premiums, and insurer recommendations for each policy to client.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Follow up with client on project insurance proposal', isActive: true, slaDays: 3 },
      { id: 'wt_project_s4', caseTypeId: 'wt_project', name: 'Client Confirmation', order: 4, description: 'Client confirms insurer selection for each policy. Obtain written confirmation of approved coverages before proceeding.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Obtain written confirmation from client for all selected policies', isActive: true, slaDays: 2 },
      { id: 'wt_project_s5', caseTypeId: 'wt_project', name: 'Collect Documents', order: 5, description: 'Collect all application documents — company profile, SSM, director IC, application forms, workers list, site plan, and supporting documents.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Chase client for outstanding application documents', isActive: true, slaDays: 7 },
      { id: 'wt_project_s6', caseTypeId: 'wt_project', name: 'Confirm Payment', order: 6, description: 'Client settles premiums for all policies. Confirm receipt of each payment and prepare submission packages.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Confirm all premium payments received and issue receipts', isActive: true, slaDays: 2 },
      { id: 'wt_project_s7', caseTypeId: 'wt_project', name: 'Issue Policies', order: 7, description: 'Submit to insurers. Follow up for all policy certificates. Verify each policy on receipt — coverage dates, sum insured, and insured name.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Follow up with insurers for all policy certificates', isActive: true, slaDays: 5 },
      { id: 'wt_project_s8', caseTypeId: 'wt_project', name: 'Close Case', order: 8, description: 'Deliver all policy documents to client. Record expiry dates for each policy and set renewal reminders.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Confirm client received all policy documents and record expiry dates', isActive: true, slaDays: 1 },
    ],
  },

  // ─── 4. Claim Workflow ───────────────────────────────────────────────────────
  {
    id: 'wt_claim',
    caseType: 'Claim Workflow',
    description: 'For handling claims under existing bonds or insurance policies — from claim notification to settlement.',
    isActive: true,
    requiredDocuments: [
      { id: 'wt_claim_d1', caseTypeId: 'wt_claim', name: 'Policy / Bond Certificate', description: 'Copy of the active policy or bond certificate under which the claim is being made', required: true, acceptedFileTypes: ['PDF', 'JPG'], isActive: true },
      { id: 'wt_claim_d2', caseTypeId: 'wt_claim', workflowStepId: 'wt_claim_s2', name: 'Claim Form', description: 'Completed and signed claim form from the insurer', required: true, acceptedFileTypes: ['PDF', 'DOCX'], isActive: true },
      { id: 'wt_claim_d3', caseTypeId: 'wt_claim', workflowStepId: 'wt_claim_s2', name: 'Incident / Accident Report', description: 'Written report of the incident — date, time, location, circumstances, and parties involved', required: true, acceptedFileTypes: ['PDF', 'DOCX'], isActive: true },
      { id: 'wt_claim_d4', caseTypeId: 'wt_claim', workflowStepId: 'wt_claim_s3', name: 'Supporting Evidence', description: 'Photographs, invoices, receipts, or other evidence supporting the claim amount', required: true, acceptedFileTypes: ['PDF', 'JPG', 'PNG', 'XLSX'], isActive: true },
      { id: 'wt_claim_d5', caseTypeId: 'wt_claim', workflowStepId: 'wt_claim_s3', name: 'Medical Report (if applicable)', description: 'Medical certificate or report from registered physician (required for bodily injury or WC claims)', required: false, acceptedFileTypes: ['PDF', 'JPG'], isActive: true },
      { id: 'wt_claim_d6', caseTypeId: 'wt_claim', workflowStepId: 'wt_claim_s3', name: 'Police Report (if applicable)', description: 'Police report for accident, theft, or third-party claims', required: false, acceptedFileTypes: ['PDF', 'JPG'], isActive: true },
    ],
    workflowSteps: [
      { id: 'wt_claim_s1', caseTypeId: 'wt_claim', name: 'Receive Claim Notification', order: 1, description: 'Receive claim notification from client. Confirm date of loss, nature of claim, and which policy is affected. Acknowledge receipt and advise on next steps.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Acknowledge claim receipt and gather initial details from client', isActive: true, slaDays: 1 },
      { id: 'wt_claim_s2', caseTypeId: 'wt_claim', name: 'Verify Coverage', order: 2, description: 'Verify the policy is in force on the date of loss, the incident falls within coverage scope, and check any excess, deductible, or exclusions. Advise client accordingly.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Confirm policy coverage and advise client of next steps', isActive: true, slaDays: 2 },
      { id: 'wt_claim_s3', caseTypeId: 'wt_claim', name: 'Submit Claim to Insurer', order: 3, description: 'Compile all claim documents and submit formal claim to insurer. Obtain claim reference number and confirm submission received.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Follow up with insurer to confirm claim submission received and get reference number', isActive: true, slaDays: 3 },
      { id: 'wt_claim_s4', caseTypeId: 'wt_claim', name: 'Follow Up with Insurer', order: 4, description: 'Monitor claim progress. Follow up regularly with insurer. Provide any additional documents requested. Update client on status.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Follow up with insurer on claim assessment progress', isActive: true, slaDays: 14 },
      { id: 'wt_claim_s5', caseTypeId: 'wt_claim', name: 'Claim Assessment', order: 5, description: 'Insurer appoints adjuster or assessor. Facilitate site access and provide additional information as requested. Attend assessment if needed.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Follow up with insurer on claim assessment outcome', isActive: true, slaDays: 7 },
      { id: 'wt_claim_s6', caseTypeId: 'wt_claim', name: 'Claim Settlement', order: 6, description: 'Insurer issues settlement offer. Review offer with client. If acceptable, obtain client written acceptance. Coordinate payment receipt.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Advise client on settlement offer and obtain written acceptance', isActive: true, slaDays: 7 },
      { id: 'wt_claim_s7', caseTypeId: 'wt_claim', name: 'Close Case', order: 7, description: 'Settlement received by client. Record claim outcome, settlement amount, and insurer. Close case with complete documentation on file.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Confirm client received claim settlement and close case', isActive: true, slaDays: 2 },
    ],
  },

  // ─── 5. Renewal Workflow ─────────────────────────────────────────────────────
  {
    id: 'wt_renewal',
    caseType: 'Renewal Workflow',
    description: 'Annual renewal process for existing bonds and policies — from expiry identification to renewed certificate delivery.',
    isActive: true,
    requiredDocuments: [
      {
        id: 'wt_renewal_d1', caseTypeId: 'wt_renewal', name: 'Previous Policy / Bond Certificate',
        description: 'Copy of existing policy or bond certificate being renewed', required: true,
        acceptedFileTypes: ['PDF', 'JPG'], isActive: true,
        aiPrompt: `This is a performance bond certificate, bank guarantee, or insurance policy document for renewal purposes.

Extract the following:
- customerName: The INSURED / PRINCIPAL company name and registration number
- projectName: The project description or risk location as stated in the certificate
- caseType: Bond or insurance type (e.g. "Performance Bond", "Contractor All Risk", "Workmen Compensation")
- amount: Contract value or sum insured (if stated)
- bondValue: The guaranteed / insured amount
- expiryDate: The bond or policy EXPIRY DATE / Tarikh Tamat / validity end date
- notes: Certificate or policy number, issuing insurer or bank name`,
      },
      { id: 'wt_renewal_d2', caseTypeId: 'wt_renewal', name: 'Updated Bank Statement', description: 'Latest 3 months bank statement if required by insurer for renewal', required: false, acceptedFileTypes: ['PDF'], isActive: true },
      { id: 'wt_renewal_d3', caseTypeId: 'wt_renewal', name: 'Revised Workers List (for WC renewals)', description: 'Updated workers list with current headcount, wages, and job scopes', required: false, acceptedFileTypes: ['PDF', 'XLSX'], isActive: true },
    ],
    workflowSteps: [
      { id: 'wt_renewal_s1', caseTypeId: 'wt_renewal', name: 'Identify Upcoming Renewal', order: 1, description: 'Review expiry date and contact client to confirm renewal intention. Check if sum insured, coverage period, or terms need updating for the renewal.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Contact client to confirm renewal intention and check if any changes needed', isActive: true, slaDays: 3 },
      { id: 'wt_renewal_s2', caseTypeId: 'wt_renewal', name: 'Request Renewal Quotation', order: 2, description: 'Send renewal quotation requests to the current insurer and/or alternative insurers if a market check is warranted.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Follow up with insurers for renewal quotations', isActive: true, aiEmailEnabled: true, slaDays: 5 },
      { id: 'wt_renewal_s3', caseTypeId: 'wt_renewal', name: 'Present Renewal Quote', order: 3, description: 'Present renewal quotation to client. Compare with current terms and advise if switching insurer is beneficial. Recommend course of action.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Follow up with client on renewal quotation decision', isActive: true, slaDays: 3 },
      { id: 'wt_renewal_s4', caseTypeId: 'wt_renewal', name: 'Client Confirmation', order: 4, description: 'Client confirms renewal with selected insurer. Collect premium payment and any updated documents required.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Obtain renewal confirmation and collect premium payment', isActive: true, slaDays: 2 },
      { id: 'wt_renewal_s5', caseTypeId: 'wt_renewal', name: 'Collect Updated Documents', order: 5, description: 'Collect any updated documents required for renewal — financial statements, revised worker lists, or bank statements as required by insurer.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Request updated documents from client for renewal submission', isActive: true, slaDays: 5 },
      { id: 'wt_renewal_s6', caseTypeId: 'wt_renewal', name: 'Process Renewal', order: 6, description: 'Submit renewal to insurer. Follow up for renewed certificate. Verify expiry date and all policy terms on receipt.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Follow up with insurer for renewed certificate issuance', isActive: true, slaDays: 5 },
      { id: 'wt_renewal_s7', caseTypeId: 'wt_renewal', name: 'Close Case', order: 7, description: 'Deliver renewed certificate to client. Update expiry date in system and set next renewal reminder 90 days before the new expiry.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Confirm client received renewed certificate and update renewal date', isActive: true, slaDays: 1 },
    ],
  },

  // ─── 6. Endorsement Workflow ─────────────────────────────────────────────────
  {
    id: 'wt_endorse',
    caseType: 'Endorsement Workflow',
    description: 'Mid-term changes to existing bonds or policies — sum insured adjustments, period extensions, name changes, or other amendments.',
    isActive: true,
    requiredDocuments: [
      { id: 'wt_endorse_d1', caseTypeId: 'wt_endorse', workflowStepId: 'wt_endorse_s2', name: 'Current Policy / Bond Certificate', description: 'Original policy or bond certificate to be endorsed', required: true, acceptedFileTypes: ['PDF', 'JPG'], isActive: true },
      { id: 'wt_endorse_d2', caseTypeId: 'wt_endorse', workflowStepId: 'wt_endorse_s3', name: 'Endorsement Request Letter', description: "Client's written request for the mid-term change, on company letterhead with authorised signature", required: true, acceptedFileTypes: ['PDF', 'DOCX'], isActive: true },
      { id: 'wt_endorse_d3', caseTypeId: 'wt_endorse', workflowStepId: 'wt_endorse_s3', name: 'Supporting Documents', description: 'Documents supporting the endorsement request — contract variation order, revised LOA, updated project details', required: false, acceptedFileTypes: ['PDF', 'DOCX', 'JPG'], isActive: true },
    ],
    workflowSteps: [
      { id: 'wt_endorse_s1', caseTypeId: 'wt_endorse', name: 'Receive Endorsement Request', order: 1, description: 'Receive request for mid-term change from client. Confirm which policy is affected and exactly what needs to change — sum insured, period, name, or other terms.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Acknowledge endorsement request and clarify required changes with client', isActive: true, slaDays: 1 },
      { id: 'wt_endorse_s2', caseTypeId: 'wt_endorse', name: 'Verify Current Policy', order: 2, description: 'Obtain current policy or bond certificate. Verify existing terms, check if the requested change is permissible, and determine if additional premium applies.', requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Obtain current policy certificate from client or insurer records', isActive: true, slaDays: 2 },
      { id: 'wt_endorse_s3', caseTypeId: 'wt_endorse', name: 'Submit Endorsement to Insurer', order: 3, description: "Prepare endorsement request with client's supporting documents and submit to insurer for approval.", requireDocumentsComplete: true, defaultFollowUpSuggestion: 'Follow up with insurer to confirm endorsement request received', isActive: true, slaDays: 3 },
      { id: 'wt_endorse_s4', caseTypeId: 'wt_endorse', name: 'Get Endorsement Approval', order: 4, description: 'Follow up with insurer for endorsement approval. Collect any additional premium debit note or process refund credit note as applicable.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Follow up with insurer on endorsement approval and additional premium or refund', isActive: true, slaDays: 7 },
      { id: 'wt_endorse_s5', caseTypeId: 'wt_endorse', name: 'Issue Endorsement Certificate', order: 5, description: 'Receive endorsement certificate from insurer. Verify all amended terms are correctly reflected before delivering to client.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Follow up with insurer for endorsement certificate issuance', isActive: true, slaDays: 3 },
      { id: 'wt_endorse_s6', caseTypeId: 'wt_endorse', name: 'Close Case', order: 6, description: 'Deliver endorsement certificate to client. Update case records to reflect the amended policy terms and new effective date.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Confirm client received endorsement certificate and update policy records', isActive: true, slaDays: 1 },
    ],
  },

  // ─── 7. Servicing Workflow ───────────────────────────────────────────────────
  {
    id: 'wt_service',
    caseType: 'Servicing Workflow',
    description: 'Administrative and servicing requests — certificate copies, policy queries, payment records, and general client support.',
    isActive: true,
    requiredDocuments: [
      { id: 'wt_service_d1', caseTypeId: 'wt_service', name: 'Supporting Documents', description: 'Any documents provided by client in relation to the servicing request', required: false, acceptedFileTypes: ['PDF', 'DOCX', 'JPG', 'PNG'], isActive: true },
    ],
    workflowSteps: [
      { id: 'wt_service_s1', caseTypeId: 'wt_service', name: 'Receive Servicing Request', order: 1, description: 'Receive and log the servicing request. Confirm what is needed: certificate copy, policy clarification, payment record, certificate of currency, or other.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Acknowledge servicing request and clarify requirements with client', isActive: true, slaDays: 1 },
      { id: 'wt_service_s2', caseTypeId: 'wt_service', name: 'Verify Policy Details', order: 2, description: 'Verify current policy status, insurer, and terms. Determine if the request can be fulfilled internally or requires insurer involvement.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Verify policy details and confirm ability to fulfil request', isActive: true, slaDays: 1 },
      { id: 'wt_service_s3', caseTypeId: 'wt_service', name: 'Process Request', order: 3, description: 'Process the request — obtain documents from insurer, prepare requested information, or coordinate with relevant parties to fulfil the request.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Follow up with insurer or internal team to process servicing request', isActive: true, slaDays: 3 },
      { id: 'wt_service_s4', caseTypeId: 'wt_service', name: 'Deliver to Client', order: 4, description: 'Deliver requested documents or information to client via preferred channel (email, courier, or in-person). Confirm receipt.', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Confirm client received requested information or documents', isActive: true, slaDays: 1 },
      { id: 'wt_service_s5', caseTypeId: 'wt_service', name: 'Close Case', order: 5, description: 'Request fulfilled. Record outcome and close case. Note any follow-on actions required (e.g. pending renewal, pending endorsement).', requireDocumentsComplete: false, defaultFollowUpSuggestion: 'Confirm servicing request completed and close case', isActive: true, slaDays: 1 },
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
