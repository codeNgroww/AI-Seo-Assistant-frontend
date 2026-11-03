'use client';

import React, { useState, useEffect } from 'react';
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
  ExternalLink,
  History,
  FileCheck,
  Building2,
  ShieldAlert,
  Info
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

export default function AiSeoDashboard() {
  // Section A: Page Information (defaults specified in assessment)
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

  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'audit' | 'safety'>('editor');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Sync state when draft updates
  const syncDraftToEditor = (draft: SeoDraft) => {
    setCurrentDraft(draft);
    setEditableTitle(draft.content.seoTitle);
    setEditableMetaDesc(draft.content.metaDescription);
    setEditableFaqs(draft.content.faqs || []);
  };

  // 1. Generate Suggestions via NestJS API
  const handleGenerate = async () => {
    if (!pageTitle.trim() || !pageDescription.trim()) {
      showToast('Page Title and Description cannot be empty.', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'ADMIN',
          'x-user-name': 'Space42 Admin',
        },
        body: JSON.stringify({ pageTitle, pageDescription }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to generate suggestions');
      }

      const draft: SeoDraft = await res.json();
      syncDraftToEditor(draft);
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
        'Action Blocked: Content is currently in DRAFT status. Human approval (APPROVED status) is strictly required before publishing.',
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
      showToast('Maximum 5 FAQs recommended for optimal SEO snippet size.', 'warning');
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
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-2xl backdrop-blur-xl animate-bounce-short transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
              : toast.type === 'warning'
              ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
              : 'bg-cyan-950/90 border-cyan-500/50 text-cyan-200'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />}
          {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-cyan-400 shrink-0" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">AI SEO Assistant</h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                  Space42 Arena
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Safe AI Architecture • PII Redaction • HITL Approval Gate
              </p>
            </div>
          </div>

          {/* Quick Preset Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPageTitle('Space42 Arena – Summer Music Festival');
                setPageDescription('A fictional music festival featuring live performances, food stalls and entertainment in Abu Dhabi.');
                showToast('Reset to Space42 Arena default event inputs.', 'info');
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors flex items-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Space42 Default</span>
            </button>
            <button
              onClick={() => {
                setPageTitle('DrVet Clinic – 24/7 Veterinary Emergency Care');
                setPageDescription('Licensed veterinary hospital providing around-the-clock emergency care, surgery, and wellness checkups for pets in Abu Dhabi.');
                showToast('Loaded DrVet medical scenario preset.', 'info');
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors hidden md:flex items-center gap-1.5"
            >
              <span>DrVet Scenario</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* Safety & Status Highlights Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-4 rounded-xl flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">PII Redaction Guard</p>
              <p className="text-sm font-bold text-emerald-400">
                {currentDraft?.safetyReport?.piiRedacted
                  ? `${currentDraft.safetyReport.redactedItemsCount} Tokens Scrubbed`
                  : 'Active & Protecting Input'}
              </p>
            </div>
          </div>

          <div className="glass-card p-4 rounded-xl flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Approval Status</p>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    !currentDraft
                      ? 'bg-slate-800 text-slate-400 border border-slate-700'
                      : currentDraft.status === 'PUBLISHED'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                      : currentDraft.status === 'APPROVED'
                      ? 'bg-blue-950 text-blue-300 border border-blue-600'
                      : 'bg-amber-950 text-amber-300 border border-amber-600'
                  }`}
                >
                  {currentDraft ? currentDraft.status : 'NO DRAFT ACTIVE'}
                </span>
                {currentDraft?.status === 'DRAFT' && (
                  <span className="text-xs text-amber-400/90 font-medium">Approval Required</span>
                )}
              </div>
            </div>
          </div>

          <div className="glass-card p-4 rounded-xl flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Engine</p>
              <p className="text-sm font-bold text-purple-300">Mock LLM Provider (Pluggable)</p>
            </div>
          </div>
        </div>

        {/* SECTION A: Page Information */}
        <section className="glass-panel p-6 sm:p-8 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-cyan-600 text-white flex items-center justify-center text-xs font-bold">
                  A
                </span>
                Page Information
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Provide the event page details to feed into the safe AI SEO suggestion generator.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label htmlFor="page-title" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Page Title
              </label>
              <input
                id="page-title"
                type="text"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                placeholder="e.g. Space42 Arena – Summer Music Festival"
                className="w-full px-4 py-3 bg-slate-900/90 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm font-medium transition-all"
              />
            </div>

            <div>
              <label htmlFor="page-description" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Page Description
              </label>
              <textarea
                id="page-description"
                rows={3}
                value={pageDescription}
                onChange={(e) => setPageDescription(e.target.value)}
                placeholder="Describe the event, features, location, and highlights..."
                className="w-full px-4 py-3 bg-slate-900/90 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm font-medium transition-all"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                id="btn-generate-seo"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-cyan-500/25 flex items-center gap-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
            
            {/* View Tabs */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('editor')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'editor'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Editable Content</span>
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'preview'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Google SERP Preview</span>
                </button>
                <button
                  onClick={() => setActiveTab('safety')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'safety'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
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
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'audit'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Audit Trail ({currentDraft.auditTrail.length})</span>
                </button>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Status:</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
                    currentDraft.status === 'PUBLISHED'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                      : currentDraft.status === 'APPROVED'
                      ? 'bg-blue-950 text-blue-300 border border-blue-500/50'
                      : 'bg-amber-950 text-amber-300 border border-amber-500/50 animate-pulse'
                  }`}
                >
                  {currentDraft.status}
                </span>
              </div>
            </div>

            {/* TAB 1: Editor */}
            {activeTab === 'editor' && (
              <section className="glass-panel p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                        B
                      </span>
                      Generated SEO Content (Editable)
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Review and modify the AI suggestions below before submitting for approval.
                    </p>
                  </div>
                </div>

                {/* 1. Suggested SEO Title */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="seo-title" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      1. Suggested SEO Title
                    </label>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded ${
                          isTitleOver
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : isTitleOptimal
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {titleLen} / 70 max chars
                      </span>
                      {isTitleOver && (
                        <span className="text-xs text-rose-400 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Exceeds 70-char SERP limit
                        </span>
                      )}
                    </div>
                  </div>
                  <input
                    id="seo-title"
                    type="text"
                    value={editableTitle}
                    onChange={(e) => setEditableTitle(e.target.value)}
                    className={`w-full px-4 py-3 bg-slate-900 border rounded-xl text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                      isTitleOver
                        ? 'border-rose-500 focus:ring-rose-500/40'
                        : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/40'
                    }`}
                  />
                  {/* Progress bar */}
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isTitleOver ? 'bg-rose-500' : isTitleOptimal ? 'bg-emerald-500' : 'bg-cyan-500'
                      }`}
                      style={{ width: `${Math.min(100, (titleLen / 70) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* 2. Meta Description */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="meta-desc" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      2. Meta Description
                    </label>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded ${
                          isMetaOver
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : isMetaOptimal
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {metaLen} / 160 max chars
                      </span>
                      {isMetaOver && (
                        <span className="text-xs text-rose-400 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Exceeds 160-char limit
                        </span>
                      )}
                    </div>
                  </div>
                  <textarea
                    id="meta-desc"
                    rows={3}
                    value={editableMetaDesc}
                    onChange={(e) => setEditableMetaDesc(e.target.value)}
                    className={`w-full px-4 py-3 bg-slate-900 border rounded-xl text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                      isMetaOver
                        ? 'border-rose-500 focus:ring-rose-500/40'
                        : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/40'
                    }`}
                  />
                  {/* Progress bar */}
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isMetaOver ? 'bg-rose-500' : isMetaOptimal ? 'bg-emerald-500' : 'bg-cyan-500'
                      }`}
                      style={{ width: `${Math.min(100, (metaLen / 160) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* 3. FAQ Section */}
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        3. FAQ Section ({editableFaqs.length} entries)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Edit, delete, or add questions to be included in event rich snippets.
                      </p>
                    </div>
                    <button
                      onClick={handleAddFaq}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add FAQ</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {editableFaqs.map((faq, index) => (
                      <div
                        key={faq.id || index}
                        className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center shrink-0">
                              {index + 1}
                            </span>
                            <input
                              type="text"
                              value={faq.question}
                              onChange={(e) => handleFaqChange(index, 'question', e.target.value)}
                              placeholder="Enter FAQ Question..."
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                          <button
                            onClick={() => handleDeleteFaq(index)}
                            title="Delete FAQ"
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
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
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
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
              <section className="glass-panel p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Search className="w-5 h-5 text-cyan-400" />
                    Google Search Result Simulator
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live desktop search snippet rendering based on current title and meta description.
                  </p>
                </div>

                {/* Google Snippet Box */}
                <div className="p-6 rounded-xl bg-white text-black max-w-2xl shadow-xl font-sans space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                      S
                    </div>
                    <span>https://space42arena.ae › events › summer-music-festival</span>
                  </div>

                  <h3 className="text-xl text-[#1a0dab] hover:underline cursor-pointer font-medium leading-tight">
                    {editableTitle || 'Space42 Arena Summer Music Festival 2026 | Abu Dhabi'}
                  </h3>

                  <p className="text-sm text-[#4d5156] leading-snug">
                    {editableMetaDesc || 'A fictional music festival featuring live performances, food stalls and entertainment in Abu Dhabi.'}
                  </p>

                  {/* FAQ Rich snippet mockup */}
                  {editableFaqs.length > 0 && (
                    <div className="pt-3 border-t border-slate-200 mt-2 space-y-2">
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">People Also Ask</p>
                      {editableFaqs.slice(0, 2).map((faq, i) => (
                        <div key={i} className="text-xs text-slate-800 pl-2 border-l-2 border-blue-500">
                          <p className="font-semibold text-blue-900">{faq.question}</p>
                          <p className="text-slate-600 line-clamp-1">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* TAB 3: Safety Guardrails Report */}
            {activeTab === 'safety' && (
              <section className="glass-panel p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    Safe AI & Quality Guardrails Telemetry
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Automated data protection and hallucination checks performed prior to admin review.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Outbound PII Sanitization</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      All customer emails, phone numbers (+971...), national IDs (Emirates ID), and secret API keys are scrubbed before prompt submission to the LLM.
                    </p>
                    <div className="text-xs px-3 py-2 rounded-lg bg-slate-950 font-mono text-slate-400">
                      Status: {currentDraft.safetyReport?.piiRedacted ? 'Redactions performed' : 'No PII detected in inputs (Clean)'}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                      <FileCheck className="w-4 h-4" />
                      <span>Accuracy & Hallucination Guard</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Post-generation scanner checks for fabricated clinical guarantees ("100% cure"), unverified free pricing, or currency claims not present in source info.
                    </p>
                    <div className="text-xs px-3 py-2 rounded-lg bg-slate-950 font-mono text-slate-400">
                      Accuracy Check: {currentDraft.safetyReport?.accuracyPassed ? 'Passed (No high-risk claims detected)' : 'Review Required'}
                    </div>
                  </div>
                </div>

                {currentDraft.safetyReport?.warnings && currentDraft.safetyReport.warnings.length > 0 && (
                  <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/40 space-y-2">
                    <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Safety Review Flags:</span>
                    </div>
                    <ul className="list-disc list-inside text-xs text-amber-200/90 space-y-1">
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
              <section className="glass-panel p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-400" />
                    Immutable Audit Trail
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Full history of actions, human reviews, edits, and timestamps for governance compliance.
                  </p>
                </div>

                <div className="space-y-3">
                  {currentDraft.auditTrail.map((entry, index) => (
                    <div
                      key={entry.id || index}
                      className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              entry.action === 'PUBLISHED'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                : entry.action === 'APPROVED'
                                ? 'bg-blue-950 text-blue-300 border border-blue-700'
                                : entry.action === 'EDITED'
                                ? 'bg-purple-950 text-purple-300 border border-purple-700'
                                : 'bg-amber-950 text-amber-300 border border-amber-700'
                            }`}
                          >
                            {entry.action}
                          </span>
                          <span className="text-xs font-semibold text-slate-300">{entry.actor}</span>
                        </div>
                        <p className="text-xs text-slate-400">{entry.notes}</p>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SECTION C: Approval Workflow Action Bar */}
            <section className="glass-panel p-6 rounded-2xl shadow-2xl border border-slate-700/80">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-purple-600 text-white flex items-center justify-center text-xs font-bold">
                      C
                    </span>
                    Human-in-the-Loop Approval Actions
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    AI generation remains in DRAFT. Review and explicitly approve before publishing.
                  </p>
                </div>

                {/* Workflow Stepper Indicator */}
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <div
                    className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                      currentDraft.status === 'DRAFT'
                        ? 'bg-amber-950/80 border-amber-500 text-amber-300 ring-2 ring-amber-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    <span>1. DRAFT</span>
                  </div>
                  <span className="text-slate-600">➔</span>
                  <div
                    className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                      currentDraft.status === 'APPROVED'
                        ? 'bg-blue-950/80 border-blue-500 text-blue-300 ring-2 ring-blue-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    <span>2. APPROVED</span>
                  </div>
                  <span className="text-slate-600">➔</span>
                  <div
                    className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                      currentDraft.status === 'PUBLISHED'
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
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
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>Regenerate Suggestions</span>
                  </button>

                  {/* Action 2: Save Draft */}
                  <button
                    id="btn-save-draft"
                    onClick={handleSaveDraft}
                    disabled={isSaving || currentDraft.status === 'PUBLISHED'}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Save Draft</span>
                  </button>

                  {/* Action 3: Approve Content */}
                  <button
                    id="btn-approve-content"
                    onClick={handleApprove}
                    disabled={isApproving || currentDraft.status === 'PUBLISHED' || currentDraft.status === 'APPROVED'}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{currentDraft.status === 'APPROVED' ? 'Approved ✓' : 'Approve Content'}</span>
                  </button>

                  {/* Action 4: Publish Content */}
                  <button
                    id="btn-publish-content"
                    onClick={handlePublish}
                    disabled={isPublishing || currentDraft.status === 'PUBLISHED'}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 transition-all cursor-pointer ${
                      currentDraft.status === 'APPROVED'
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/25 ring-2 ring-emerald-400/50'
                        : currentDraft.status === 'PUBLISHED'
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 border border-slate-700'
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
