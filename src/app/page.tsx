'use client';

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Plus,
  Eye,
  Search,
  History,
  FileCheck,
  Building2,
  ShieldAlert,
  Info,
  SlidersHorizontal,
  ArrowRight,
  Eraser
} from 'lucide-react';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: 'GENERATED' | 'EDITED' | 'APPROVED' | 'PUBLISHED' | 'REGENERATED';
  actor: string;
  notes?: string;
}

interface SeoDraft {
  id: string;
  pageTitle: string;
  pageDescription: string;
  status: 'DRAFT' | 'APPROVED' | 'PUBLISHED';
  content: {
    seoTitle: string;
    metaDescription: string;
    faqs: FaqItem[];
  };
  safetyReport?: {
    piiRedacted: boolean;
    redactedItemsCount: number;
    accuracyPassed: boolean;
    warnings: string[];
  };
  auditTrail: AuditLogEntry[];
  publishedAt?: string;
}

const API_BASE = 'http://localhost:3001/api/seo';

// Client-side regex detectors for instant feedback
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/;
const CARD_REGEX = /\b(?:\d{4}[-\s]?){3}\d{4}\b/;

export default function AiSeoDashboard() {
  // Section A: Page Information (Assessment defaults)
  const [pageTitle, setPageTitle] = useState('Space42 Arena – Summer Music Festival');
  const [pageDescription, setPageDescription] = useState(
    'A fictional music festival featuring live performances, food stalls and entertainment in Abu Dhabi.'
  );

  // Active Draft State
  const [currentDraft, setCurrentDraft] = useState<SeoDraft | null>(null);

  // Editable Form Fields (synced with current draft)
  const [editableTitle, setEditableTitle] = useState('');
  const [editableMetaDesc, setEditableMetaDesc] = useState('');
  const [editableFaqs, setEditableFaqs] = useState<FaqItem[]>([]);

  // Security & Error State
  const [securityError, setSecurityError] = useState<string | null>(null);

  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'audit' | 'safety'>('editor');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Real-time detection in inputs
  const detectedPiiTypes = useMemo(() => {
    const combined = `${pageTitle} ${pageDescription}`;
    const detected: string[] = [];
    if (EMAIL_REGEX.test(combined)) detected.push('Email Address');
    if (CARD_REGEX.test(combined)) detected.push('Payment Card Token');
    if (PHONE_REGEX.test(combined)) {
      const match = combined.match(PHONE_REGEX);
      if (match && match[0].replace(/\D/g, '').length >= 8) {
        detected.push('Phone Number');
      }
    }
    return detected;
  }, [pageTitle, pageDescription]);

  // Sync state when draft updates
  const syncDraftToEditor = (draft: SeoDraft) => {
    setCurrentDraft(draft);
    setEditableTitle(draft.content.seoTitle);
    setEditableMetaDesc(draft.content.metaDescription);
    setEditableFaqs(draft.content.faqs || []);
  };

  // 1. Generate Suggestions via NestJS API
  const handleGenerate = async (allowRedact = false) => {
    if (!pageTitle.trim() || !pageDescription.trim()) {
      showToast('Page Title and Description cannot be empty.', 'error');
      return;
    }

    setSecurityError(null);
    setIsGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'ADMIN',
          'x-user-name': 'Space42 Admin',
        },
        body: JSON.stringify({ pageTitle, pageDescription, allowRedact }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        const msg = errorData.message || 'Failed to generate suggestions';
        
        // If security alert regarding PII
        if (res.status === 400 && (msg.includes('Security Policy Alert') || msg.includes('confidential'))) {
          setSecurityError(msg);
          showToast(msg, 'error');
          return;
        }

        throw new Error(msg);
      }

      const draft: SeoDraft = await res.json();
      syncDraftToEditor(draft);
      setSecurityError(null);
      showToast('New SEO suggestions generated! Status initialized as DRAFT.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Network error connecting to backend API at port 3001', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Save Draft Edits
  const handleSaveDraft = async () => {
    if (!currentDraft) {
      showToast('No active draft to save. Please generate suggestions first.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/draft/${currentDraft.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'ADMIN',
          'x-user-name': 'Space42 Admin',
        },
        body: JSON.stringify({
          seoTitle: editableTitle,
          metaDescription: editableMetaDesc,
          faqs: editableFaqs,
          editNotes: 'Admin manual changes saved.',
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update draft');
      }

      const updatedDraft: SeoDraft = await res.json();
      syncDraftToEditor(updatedDraft);

      if (currentDraft.status === 'APPROVED' && updatedDraft.status === 'DRAFT') {
        showToast('Draft saved. Note: Status reverted to DRAFT because approved content was altered.', 'warning');
      } else {
        showToast('Draft changes saved successfully.', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save draft changes', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Approve Content (Human Approval Gate)
  const handleApprove = async () => {
    if (!currentDraft) {
      showToast('Please generate suggestions before approving.', 'warning');
      return;
    }

    if (currentDraft.status === 'PUBLISHED') {
      showToast('Content is already published.', 'info');
      return;
    }

    setIsApproving(true);
    try {
      // First save any unsaved field changes
      await fetch(`${API_BASE}/draft/${currentDraft.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'ADMIN',
          'x-user-name': 'Space42 Admin',
        },
        body: JSON.stringify({
          seoTitle: editableTitle,
          metaDescription: editableMetaDesc,
          faqs: editableFaqs,
          editNotes: 'Saved prior to final approval.',
        }),
      });

      const res = await fetch(`${API_BASE}/draft/${currentDraft.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'ADMIN',
          'x-user-name': 'Space42 Admin',
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to approve draft');
      }

      const approved: SeoDraft = await res.json();
      syncDraftToEditor(approved);
      showToast('Content APPROVED! It is now authorized for publishing.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error during approval', 'error');
    } finally {
      setIsApproving(false);
    }
  };

  // 4. Publish Content (Guarded by HITL status check)
  const handlePublish = async () => {
    if (!currentDraft) {
      showToast('No draft available to publish.', 'warning');
      return;
    }

    if (currentDraft.status === 'DRAFT') {
      showToast(
        'Action Blocked: Content is in DRAFT status. Safe AI policy requires explicit human approval (APPROVED status) before publishing.',
        'error'
      );
      return;
    }

    if (currentDraft.status === 'PUBLISHED') {
      showToast('Content is already published.', 'info');
      return;
    }

    setIsPublishing(true);
    try {
      const res = await fetch(`${API_BASE}/draft/${currentDraft.id}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'ADMIN',
          'x-user-name': 'Space42 Admin',
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to publish content');
      }

      const published: SeoDraft = await res.json();
      syncDraftToEditor(published);
      showToast('🎉 Content successfully PUBLISHED to Space42 Arena live event page!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error publishing content', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  // 5. Regenerate Suggestions
  const handleRegenerate = async () => {
    if (!currentDraft) {
      handleGenerate();
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/draft/${currentDraft.id}/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'ADMIN',
          'x-user-name': 'Space42 Admin',
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to regenerate');
      }

      const regenerated: SeoDraft = await res.json();
      syncDraftToEditor(regenerated);
      showToast('Suggestions regenerated. Status reset to DRAFT.', 'info');
    } catch (err: any) {
      showToast(err.message || 'Regeneration failed', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // FAQ Handlers
  const handleFaqChange = (index: number, field: 'question' | 'answer', value: string) => {
    const updated = [...editableFaqs];
    updated[index] = { ...updated[index], [field]: value };
    setEditableFaqs(updated);
  };

  const handleDeleteFaq = (index: number) => {
    if (editableFaqs.length <= 1) {
      showToast('At least 1 FAQ is recommended.', 'warning');
    }
    const updated = editableFaqs.filter((_, i) => i !== index);
    setEditableFaqs(updated);
    showToast('FAQ entry removed.', 'info');
  };

  const handleAddFaq = () => {
    if (editableFaqs.length >= 5) {
      showToast('Maximum 5 FAQs recommended for optimal search snippets.', 'warning');
      return;
    }
    const newFaq: FaqItem = {
      id: `faq_${Date.now()}`,
      question: '',
      answer: '',
    };
    setEditableFaqs([...editableFaqs, newFaq]);
  };

  // Character Count Constraints
  const titleLen = editableTitle.length;
  const isTitleOver = titleLen > 70;
  const isTitleOptimal = titleLen >= 45 && titleLen <= 65;

  const metaLen = editableMetaDesc.length;
  const isMetaOver = metaLen > 160;
  const isMetaOptimal = metaLen >= 120 && metaLen <= 160;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 relative overflow-x-hidden">
      {/* Subtle ambient light gradient background meshes */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-40 right-10 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-xl backdrop-blur-md animate-fadeIn transition-all max-w-md ${
            toast.type === 'success'
              ? 'bg-emerald-50/95 border-emerald-300 text-emerald-900 shadow-emerald-500/10'
              : toast.type === 'error'
              ? 'bg-rose-50/95 border-rose-300 text-rose-900 shadow-rose-500/10'
              : toast.type === 'warning'
              ? 'bg-amber-50/95 border-amber-300 text-amber-900 shadow-amber-500/10'
              : 'bg-indigo-50/95 border-indigo-300 text-indigo-900 shadow-indigo-500/10'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
          {toast.type === 'error' && <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />}
          {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-indigo-600 shrink-0" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">AI SEO Assistant</h1>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Space42 Arena
                </span>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Admin Console
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Safe AI Active
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block mt-0.5">
                Enterprise Search Optimization • PII Redaction Guard • Human-in-the-Loop Signoff
              </p>
            </div>
          </div>

          {/* Quick Preset Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPageTitle('Space42 Arena – Summer Music Festival');
                setPageDescription('A fictional music festival featuring live performances, food stalls and entertainment in Abu Dhabi.');
                setSecurityError(null);
                showToast('Reset to Space42 Arena default event inputs.', 'info');
              }}
              className="text-xs px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 font-semibold text-slate-700 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Space42 Default</span>
            </button>
            <button
              onClick={() => {
                setPageTitle('Space42 Arena – VIP Tickets Booking');
                setPageDescription('Contact organizer at bookings@space42-arena.ae or call +971-50-9876543. Credit card token: 4532-1234-5678-9012.');
                setSecurityError(null);
                showToast('Loaded PII test input (includes phone, email, card token) to test rejection error.', 'warning');
              }}
              className="text-xs px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 font-bold text-rose-800 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>Test PII Rejection</span>
            </button>
            <button
              onClick={() => {
                setPageTitle('DrVet Clinic – 24/7 Veterinary Emergency Care');
                setPageDescription('Licensed veterinary hospital providing around-the-clock emergency care, surgery, and wellness checkups for pets in Abu Dhabi.');
                setSecurityError(null);
                showToast('Loaded DrVet scenario preset.', 'info');
              }}
              className="text-xs px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 font-semibold text-slate-700 shadow-xs transition-all hidden md:flex items-center gap-1.5 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-violet-600" />
              <span>DrVet Scenario</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* Safety & Status Highlights Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="glass-card p-5 rounded-2xl flex items-center gap-4 transition-all">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">PII Sanitization Guard</p>
              <p className="text-sm font-extrabold text-emerald-800 mt-0.5">
                {currentDraft?.safetyReport?.piiRedacted
                  ? `${currentDraft.safetyReport.redactedItemsCount} Confidential Items Scrubbed`
                  : 'Active & Rejecting Leaks'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Phone numbers, emails, card tokens protected</p>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl flex items-center gap-4 transition-all">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Approval Governance</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold tracking-wide ${
                    !currentDraft
                      ? 'bg-slate-100 text-slate-600 border border-slate-200'
                      : currentDraft.status === 'PUBLISHED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : currentDraft.status === 'APPROVED'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                  }`}
                >
                  {currentDraft ? currentDraft.status : 'NO ACTIVE DRAFT'}
                </span>
                {currentDraft?.status === 'DRAFT' && (
                  <span className="text-xs font-bold text-amber-700">Requires Approval</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Cannot publish directly without human sign-off</p>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl flex items-center gap-4 transition-all">
            <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI Generation Engine</p>
              <p className="text-sm font-extrabold text-violet-900 mt-0.5">Mock LLM Provider (Pluggable)</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Secrets securely isolated on backend</p>
            </div>
          </div>
        </div>

        {/* SECTION A: Page Information */}
        <section className="glass-panel p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden bg-white">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-sm">
                  A
                </span>
                Page Information
              </h2>
              <p className="text-xs font-medium text-slate-500 mt-1">
                Provide the event page details to feed into the safe AI SEO suggestion generator.
              </p>
            </div>
          </div>

          {/* Security Alert Banner when PII is detected or thrown */}
          {securityError && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 shadow-sm animate-fadeIn flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0 mt-0.5">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-rose-900 flex items-center gap-1.5">
                    Security Policy Violation – Input Blocked
                  </h4>
                  <p className="text-xs font-medium text-rose-800 mt-0.5 leading-relaxed">
                    {securityError}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleGenerate(true)}
                  disabled={isGenerating}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Auto-Scrub & Generate</span>
                </button>
                <button
                  onClick={() => setSecurityError(null)}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200 transition-all cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="page-title" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Page Title
                </label>
                <span className="text-xs text-slate-400">Default Space42 Arena Event</span>
              </div>
              <input
                id="page-title"
                type="text"
                value={pageTitle}
                onChange={(e) => {
                  setPageTitle(e.target.value);
                  setSecurityError(null);
                }}
                placeholder="e.g. Space42 Arena – Summer Music Festival"
                className="w-full px-4 py-3.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 text-sm font-semibold transition-all shadow-2xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="page-description" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Page Description
                </label>
                <span className="text-xs text-slate-400">Context for LLM analysis</span>
              </div>
              <textarea
                id="page-description"
                rows={3}
                value={pageDescription}
                onChange={(e) => {
                  setPageDescription(e.target.value);
                  setSecurityError(null);
                }}
                placeholder="Describe the event, features, location, and highlights..."
                className="w-full px-4 py-3.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 text-sm font-medium transition-all shadow-2xs leading-relaxed"
              />

              {/* Real-time Inline PII detection warning */}
              {detectedPiiTypes.length > 0 && (
                <div className="mt-2.5 flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Confidential data detected in input:</strong> {detectedPiiTypes.join(', ')}. Generating without scrubbing will trigger a security error.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Protected: Phone numbers, emails, and card tokens are rejected or scrubbed</span>
              </div>
              <button
                id="btn-generate-seo"
                onClick={() => handleGenerate(false)}
                disabled={isGenerating}
                className="px-7 py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-500/25 flex items-center gap-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing & Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate SEO Suggestions</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* SECTION B & C: Generated SEO Content & Approval Workflow */}
        {currentDraft && (
          <div className="space-y-8 animate-fadeIn">
            
            {/* View Tabs & Status Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2 p-1 bg-slate-200/60 rounded-2xl w-fit">
                <button
                  onClick={() => setActiveTab('editor')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'editor'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Editable Content</span>
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'preview'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Google SERP Preview</span>
                </button>
                <button
                  onClick={() => setActiveTab('safety')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'safety'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Safety & Guardrails</span>
                  {currentDraft.safetyReport?.warnings?.length ? (
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  ) : null}
                </button>
                <button
                  onClick={() => setActiveTab('audit')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'audit'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Audit Trail ({currentDraft.auditTrail.length})</span>
                </button>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Status:</span>
                <span
                  className={`px-3.5 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase ${
                    currentDraft.status === 'PUBLISHED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : currentDraft.status === 'APPROVED'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                  }`}
                >
                  {currentDraft.status}
                </span>
              </div>
            </div>

            {/* TAB 1: Editor */}
            {activeTab === 'editor' && (
              <section className="glass-panel p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-7 bg-white">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center text-xs font-black shadow-sm">
                        B
                      </span>
                      Generated SEO Content (Admin Editable)
                    </h2>
                    <p className="text-xs font-medium text-slate-500 mt-1">
                      Review, refine, and edit the AI suggestions below. You must approve the content before publishing.
                    </p>
                  </div>
                </div>

                {/* 1. Suggested SEO Title */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="seo-title" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      <span>1. Suggested SEO Title</span>
                      <span className="text-[11px] font-normal text-slate-400">(Ideal for Google SERP)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                          isTitleOver
                            ? 'bg-rose-100 text-rose-700 border border-rose-300'
                            : isTitleOptimal
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {titleLen} / 70 max chars
                      </span>
                      {isTitleOver && (
                        <span className="text-xs text-rose-600 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Exceeds 70-char limit
                        </span>
                      )}
                    </div>
                  </div>
                  <input
                    id="seo-title"
                    type="text"
                    value={editableTitle}
                    onChange={(e) => setEditableTitle(e.target.value)}
                    className={`w-full px-4 py-3.5 bg-slate-50 hover:bg-slate-50/90 focus:bg-white border rounded-xl text-slate-900 text-sm font-semibold focus:outline-none focus:ring-4 transition-all ${
                      isTitleOver
                        ? 'border-rose-400 focus:ring-rose-100 focus:border-rose-600'
                        : 'border-slate-300 focus:border-indigo-600 focus:ring-indigo-100'
                    }`}
                  />
                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isTitleOver ? 'bg-rose-500' : isTitleOptimal ? 'bg-emerald-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.min(100, (titleLen / 70) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* 2. Meta Description */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="meta-desc" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      <span>2. Meta Description</span>
                      <span className="text-[11px] font-normal text-slate-400">(Search snippet summary)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                          isMetaOver
                            ? 'bg-rose-100 text-rose-700 border border-rose-300'
                            : isMetaOptimal
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {metaLen} / 160 max chars
                      </span>
                      {isMetaOver && (
                        <span className="text-xs text-rose-600 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Exceeds 160-char limit
                        </span>
                      )}
                    </div>
                  </div>
                  <textarea
                    id="meta-desc"
                    rows={3}
                    value={editableMetaDesc}
                    onChange={(e) => setEditableMetaDesc(e.target.value)}
                    className={`w-full px-4 py-3.5 bg-slate-50 hover:bg-slate-50/90 focus:bg-white border rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-4 transition-all leading-relaxed ${
                      isMetaOver
                        ? 'border-rose-400 focus:ring-rose-100 focus:border-rose-600'
                        : 'border-slate-300 focus:border-indigo-600 focus:ring-indigo-100'
                    }`}
                  />
                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isMetaOver ? 'bg-rose-500' : isMetaOptimal ? 'bg-emerald-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.min(100, (metaLen / 160) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* 3. FAQ Section */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <span>3. FAQ Section</span>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-extrabold text-[10px]">
                          {editableFaqs.length} entries
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Edit, delete, or add questions to be included in event rich snippets.
                      </p>
                    </div>
                    <button
                      onClick={handleAddFaq}
                      className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-indigo-700 text-xs font-bold border border-slate-300 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add FAQ Entry</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {editableFaqs.map((faq, index) => (
                      <div
                        key={faq.id || index}
                        className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-indigo-300 transition-all space-y-3.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 flex-1">
                            <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center shrink-0">
                              {index + 1}
                            </span>
                            <input
                              type="text"
                              value={faq.question}
                              onChange={(e) => handleFaqChange(index, 'question', e.target.value)}
                              placeholder="Enter FAQ Question..."
                              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                            />
                          </div>
                          <button
                            onClick={() => handleDeleteFaq(index)}
                            title="Delete FAQ"
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div>
                          <textarea
                            rows={2}
                            value={faq.answer}
                            onChange={(e) => handleFaqChange(index, 'answer', e.target.value)}
                            placeholder="Enter detailed FAQ Answer..."
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 leading-relaxed"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* TAB 2: SERP Preview */}
            {activeTab === 'preview' && (
              <section className="glass-panel p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 bg-white">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2.5">
                    <Search className="w-5 h-5 text-indigo-600" />
                    Google Search Result Simulator
                  </h2>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    Live desktop search snippet rendering based on current title and meta description.
                  </p>
                </div>

                {/* Google Snippet Card */}
                <div className="p-7 rounded-2xl bg-white text-slate-900 max-w-2xl border border-slate-200 shadow-md font-sans space-y-2.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-indigo-700">
                      S
                    </div>
                    <span className="font-medium text-slate-700">https://space42arena.ae › events › summer-music-festival</span>
                  </div>

                  <h3 className="text-xl text-[#1a0dab] hover:underline cursor-pointer font-semibold leading-snug">
                    {editableTitle || 'Space42 Arena Summer Music Festival 2026 | Abu Dhabi'}
                  </h3>

                  <p className="text-sm text-[#4d5156] leading-relaxed">
                    {editableMetaDesc || 'A fictional music festival featuring live performances, food stalls and entertainment in Abu Dhabi.'}
                  </p>

                  {/* FAQ Rich snippet mockup */}
                  {editableFaqs.length > 0 && (
                    <div className="pt-4 border-t border-slate-100 mt-3 space-y-2.5">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">People Also Ask</p>
                      {editableFaqs.slice(0, 2).map((faq, i) => (
                        <div key={i} className="text-xs text-slate-800 pl-3 border-l-2 border-indigo-600 py-0.5">
                          <p className="font-bold text-indigo-950">{faq.question}</p>
                          <p className="text-slate-600 line-clamp-1 mt-0.5">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* TAB 3: Safety Guardrails Report */}
            {activeTab === 'safety' && (
              <section className="glass-panel p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 bg-white">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    Safe AI & Quality Guardrails Telemetry
                  </h2>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    Automated data protection and hallucination checks performed prior to admin review.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      <span>Outbound PII Protection Policy</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      All customer emails, phone numbers (+971...), national IDs (Emirates ID), and secret API keys are strictly rejected with an explicit error message unless auto-scrubbed.
                    </p>
                    <div className="text-xs px-3.5 py-2.5 rounded-xl bg-white border border-emerald-200 font-mono text-emerald-800 font-bold">
                      Status: {currentDraft.safetyReport?.piiRedacted ? 'Redactions performed' : 'No PII detected in inputs (Clean)'}
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3">
                    <div className="flex items-center gap-2 text-indigo-800 font-extrabold text-sm">
                      <FileCheck className="w-5 h-5 text-indigo-600" />
                      <span>Accuracy & Hallucination Guard</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      Post-generation scanner checks for fabricated clinical guarantees ("100% cure"), unverified free pricing, or currency claims not present in source info.
                    </p>
                    <div className="text-xs px-3.5 py-2.5 rounded-xl bg-white border border-indigo-200 font-mono text-indigo-800 font-bold">
                      Accuracy Check: {currentDraft.safetyReport?.accuracyPassed ? 'Passed (No high-risk claims detected)' : 'Review Required'}
                    </div>
                  </div>
                </div>

                {currentDraft.safetyReport?.warnings && currentDraft.safetyReport.warnings.length > 0 && (
                  <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                    <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Safety Review Flags:</span>
                    </div>
                    <ul className="list-disc list-inside text-xs text-amber-900 font-medium space-y-1">
                      {currentDraft.safetyReport.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* TAB 4: Audit Trail */}
            {activeTab === 'audit' && (
              <section className="glass-panel p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 bg-white">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2.5">
                    <History className="w-5 h-5 text-indigo-600" />
                    Immutable Audit Trail
                  </h2>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    Full history of actions, human reviews, edits, and timestamps for governance compliance.
                  </p>
                </div>

                <div className="space-y-3">
                  {currentDraft.auditTrail.map((entry, index) => (
                    <div
                      key={entry.id || index}
                      className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase ${
                              entry.action === 'PUBLISHED'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : entry.action === 'APPROVED'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : entry.action === 'EDITED'
                                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {entry.action}
                          </span>
                          <span className="text-xs font-bold text-slate-800">{entry.actor}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-600">{entry.notes}</p>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SECTION C: Approval Workflow Action Bar */}
            <section className="glass-panel p-6 sm:p-7 rounded-3xl shadow-lg border border-slate-200 bg-white">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                      C
                    </span>
                    Human-in-the-Loop Approval Actions
                  </h2>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    AI generation remains in DRAFT. Review and explicitly approve before publishing.
                  </p>
                </div>

                {/* Workflow Stepper Indicator */}
                <div className="flex items-center gap-2 text-xs font-bold">
                  <div
                    className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
                      currentDraft.status === 'DRAFT'
                        ? 'bg-amber-50 border-amber-300 text-amber-800 ring-2 ring-amber-200'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    <span>1. DRAFT</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <div
                    className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
                      currentDraft.status === 'APPROVED'
                        ? 'bg-blue-50 border-blue-300 text-blue-800 ring-2 ring-blue-200'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    <span>2. APPROVED</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <div
                    className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
                      currentDraft.status === 'PUBLISHED'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-200'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    <span>3. PUBLISHED</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Action 1: Regenerate Suggestions */}
                  <button
                    id="btn-regenerate"
                    onClick={handleRegenerate}
                    disabled={isGenerating || currentDraft.status === 'PUBLISHED'}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-300 shadow-xs flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>Regenerate Suggestions</span>
                  </button>

                  {/* Action 2: Save Draft */}
                  <button
                    id="btn-save-draft"
                    onClick={handleSaveDraft}
                    disabled={isSaving || currentDraft.status === 'PUBLISHED'}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-300 shadow-xs flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Save Draft</span>
                  </button>

                  {/* Action 3: Approve Content */}
                  <button
                    id="btn-approve-content"
                    onClick={handleApprove}
                    disabled={isApproving || currentDraft.status === 'PUBLISHED' || currentDraft.status === 'APPROVED'}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{currentDraft.status === 'APPROVED' ? 'Approved ✓' : 'Approve Content'}</span>
                  </button>

                  {/* Action 4: Publish Content */}
                  <button
                    id="btn-publish-content"
                    onClick={handlePublish}
                    disabled={isPublishing || currentDraft.status === 'PUBLISHED'}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all cursor-pointer ${
                      currentDraft.status === 'APPROVED'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25 ring-2 ring-emerald-300'
                        : currentDraft.status === 'PUBLISHED'
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-300'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{currentDraft.status === 'PUBLISHED' ? 'Published Live' : 'Publish Content'}</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

      </main>
    </div>
  );
}
