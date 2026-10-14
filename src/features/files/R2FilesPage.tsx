import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Cloud,
  Folder,
  FolderPlus,
  FileArchive,
  FileText,
  Package,
  File,
  Download,
  Upload,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Search,
  ArrowUp,
  AlertCircle,
  CheckCircle2,
  X,
  FileSpreadsheet,
  FileImage,
  Layers,
  Zap,
  Edit3,
  Eye,
  Archive,
  MessageSquarePlus,
  ShieldAlert,
  BarChart3,
  CheckSquare,
  Square,
  Lock,
} from "lucide-react";
import {
  R2ExplorerResponse,
  R2ObjectItem,
  SelectedFileInfo,
  ArchiveInspectResult,
  R2BucketStats,
  SimpleForumNode,
  CreateThreadResult,
  R2UploadProgress,
} from "./types";
import { InlineUploadCard } from "./components/InlineUploadCard";

interface R2FilesPageProps {
  sessionToken: string | null;
  role: string | null;
}

export const R2FilesPage: React.FC<R2FilesPageProps> = ({ sessionToken, role }) => {
  const [explorerData, setExplorerData] = useState<R2ExplorerResponse | null>(null);
  const [currentPrefix, setCurrentPrefix] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Arama & Filtreleme
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Kopyalama bildirim durumları
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<"url" | "bbcode" | null>(null);

  // Toplu Seçim (Batch Operations)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // R2 İstatistikleri & CDN Analitiği
  const [bucketStats, setBucketStats] = useState<R2BucketStats | null>(null);
  const [showStatsCard, setShowStatsCard] = useState<boolean>(true);

  // Klasör Oluşturma Modalı
  const [showFolderModal, setShowFolderModal] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>("");
  const [creatingFolder, setCreatingFolder] = useState<boolean>(false);

  // Dosya Yükleme
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<R2UploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Yeniden Adlandırma & Taşıma Modalı
  const [itemToRenameOrMove, setItemToRenameOrMove] = useState<{
    key: string;
    currentName: string;
    isFolder: boolean;
  } | null>(null);
  const [newNameInput, setNewNameInput] = useState<string>("");
  const [newFolderInput, setNewFolderInput] = useState<string>("");
  const [renaming, setRenaming] = useState<boolean>(false);

  // Görsel ve Metin Önizleme Modalı
  const [previewImage, setPreviewImage] = useState<R2ObjectItem | null>(null);
  const [previewText, setPreviewText] = useState<{ file: R2ObjectItem; content: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);

  // Arşiv İçeriği İnceleme (Zip Inspector)
  const [archiveTarget, setArchiveTarget] = useState<R2ObjectItem | null>(null);
  const [archiveInspectData, setArchiveInspectData] = useState<ArchiveInspectResult | null>(null);
  const [loadingArchive, setLoadingArchive] = useState<boolean>(false);
  const [archiveFilter, setArchiveFilter] = useState<string>("");

  // XenForo Konu Açma Modalı
  const [forumThreadTarget, setForumThreadTarget] = useState<R2ObjectItem | null>(null);
  const [forumCategories, setForumCategories] = useState<SimpleForumNode[]>([]);
  const [loadingCategories, setLoadingCategories] = useState<boolean>(false);
  const [selectedNodeId, setSelectedNodeId] = useState<number | "">("");
  const [threadTitle, setThreadTitle] = useState<string>("");
  const [threadMessage, setThreadMessage] = useState<string>("");
  const [postingThread, setPostingThread] = useState<boolean>(false);
  const [threadResult, setThreadResult] = useState<CreateThreadResult | null>(null);

  // Güvenlik Protokolü & Silme Onay Modalı
  const [itemToDelete, setItemToDelete] = useState<R2ObjectItem | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<string[] | null>(null);
  const [securityCode, setSecurityCode] = useState<string>("");
  const [securityInput, setSecurityInput] = useState<string>("");
  const [deleting, setDeleting] = useState<boolean>(false);

  // Detay İnceleme Modalı
  const [selectedFile, setSelectedFile] = useState<R2ObjectItem | null>(null);

  const isSuperAdmin = role === "super_admin";

  const fetchExplorer = async (prefix: string = currentPrefix) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res: R2ExplorerResponse = await invoke("list_r2_explorer", {
        sessionToken,
        prefix: prefix.trim() === "" ? null : prefix,
      });
      setExplorerData(res);
      setCurrentPrefix(res.current_prefix);
      setSelectedKeys(new Set());
    } catch (err: any) {
      console.error("R2 Explorer hatası:", err);
      setErrorMsg(typeof err === "string" ? err : "Cloudflare R2 dosyaları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const fetchBucketStats = async () => {
    try {
      const stats: R2BucketStats = await invoke("get_r2_stats", { sessionToken });
      setBucketStats(stats);
    } catch (err) {
      console.warn("R2 istatistikleri alınamadı:", err);
    }
  };

  useEffect(() => {
    fetchExplorer(currentPrefix);
    fetchBucketStats();
  }, [currentPrefix, sessionToken]);

  // Windows Sürükle-Bırak (Drag & Drop) Desteği
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    listen<{ paths: string[] }>("tauri://drag-drop", (event) => {
      if (event.payload && event.payload.paths && event.payload.paths.length > 0) {
        const filePath = event.payload.paths[0];
        handleUploadFromPath(filePath);
      }
    })
      .then((unlisten) => {
        unlistenFn = unlisten;
      })
      .catch((err) => {
        console.warn("Drag-drop listener başlatılamadı:", err);
      });

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [currentPrefix, sessionToken]);

  // Canlı S3 Multipart & R2 Yükleme İlerleme Dinleyicisi
  useEffect(() => {
    let unlistenProgress: (() => void) | null = null;
    listen<R2UploadProgress>("r2-upload-progress", (event) => {
      if (event.payload) {
        setUploadProgress(event.payload);
        if (event.payload.is_completed) {
          setTimeout(() => {
            fetchExplorer(currentPrefix);
            fetchBucketStats();
          }, 800);
        }
      }
    })
      .then((unlisten) => {
        unlistenProgress = unlisten;
      })
      .catch((err) => {
        console.warn("Upload progress listener başlatılamadı:", err);
      });

    return () => {
      if (unlistenProgress) unlistenProgress();
    };
  }, [currentPrefix]);

  const handleNavigate = (prefix: string) => {
    setSearchTerm("");
    setCurrentPrefix(prefix);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const folderClean = newFolderName.trim().replace(/^\/+|\/+$/g, "");
    if (!folderClean) return;

    setCreatingFolder(true);
    setErrorMsg(null);
    try {
      const fullPrefix = currentPrefix ? `${currentPrefix}${folderClean}/` : `${folderClean}/`;
      await invoke("create_r2_folder", {
        sessionToken,
        folderPrefix: fullPrefix,
      });
      setSuccessMsg(`"${folderClean}" klasörü başarıyla oluşturuldu.`);
      setShowFolderModal(false);
      setNewFolderName("");
      fetchExplorer(currentPrefix);
      fetchBucketStats();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(typeof err === "string" ? err : "Klasör oluşturulurken hata oluştu.");
    } finally {
      setCreatingFolder(false);
    }
  };

  // Doğrudan Yerel Dosya Yolundan Yükleme (Büyük Dosyalar & S3 Multipart Akışı)
  const handleUploadFromPath = async (
    localPath: string,
    fileName?: string,
    _sizeFormatted?: string
  ) => {
    const effectiveName =
      fileName ||
      localPath.split(/[\\/]/).pop() ||
      "dosya";
    const targetKey = currentPrefix ? `${currentPrefix}${effectiveName}` : effectiveName;

    // DOSYAYI ATAR ATMAZ İLERLEME ÇUBUĞUNU MODÜL İÇİNDE BAŞLAT
    setUploadProgress({
      file_name: effectiveName,
      target_key: targetKey,
      total_bytes: 0,
      uploaded_bytes: 0,
      percentage: 1.0,
      speed_mbps: 0.0,
      eta_seconds: 0,
      current_part: 1,
      total_parts: 1,
      is_completed: false,
    });
    setUploading(true);
    setErrorMsg(null);

    try {
      const uploaded: R2ObjectItem = await invoke("upload_r2_file_from_path", {
        sessionToken,
        localPath,
        targetKey,
      });

      setUploadProgress((prev) =>
        prev
          ? {
              ...prev,
              percentage: 100,
              uploaded_bytes: prev.total_bytes || uploaded.size_bytes,
              is_completed: true,
            }
          : {
              file_name: uploaded.name,
              target_key: uploaded.key,
              total_bytes: uploaded.size_bytes,
              uploaded_bytes: uploaded.size_bytes,
              percentage: 100,
              speed_mbps: 0,
              eta_seconds: 0,
              current_part: 1,
              total_parts: 1,
              is_completed: true,
            }
      );

      setSuccessMsg(`"${uploaded.name}" (${uploaded.size_formatted}) Cloudflare R2'ye başarıyla yüklendi!`);
      fetchExplorer(currentPrefix);
      fetchBucketStats();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Yükleme hatası:", err);
      setErrorMsg(typeof err === "string" ? err : "Büyük dosya yüklenirken bir hata oluştu.");
      setUploadProgress(null);
    } finally {
      setUploading(false);
    }
  };

  // Yerel Dosya Seçici Diyaloğu (Windows Explorer - Sınırsız Boyut Desteği)
  const handlePickAndUploadFile = async () => {
    try {
      const selected: SelectedFileInfo | null = await invoke("pick_file_dialog");
      if (selected) {
        await handleUploadFromPath(
          selected.file_path,
          selected.file_name,
          selected.size_formatted
        );
      }
    } catch (err: any) {
      console.error("Dosya seçici hatası:", err);
      setErrorMsg(typeof err === "string" ? err : "Dosya seçilemedi.");
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const targetKey = currentPrefix ? `${currentPrefix}${file.name}` : file.name;

    // DOSYAYI SEÇER SEÇMEZ İLERLEME ÇUBUĞUNU ÇIKAR
    setUploadProgress({
      file_name: file.name,
      target_key: targetKey,
      total_bytes: file.size,
      uploaded_bytes: 0,
      percentage: 1.0,
      speed_mbps: 0.0,
      eta_seconds: 0,
      current_part: 1,
      total_parts: 1,
      is_completed: false,
    });
    setUploading(true);
    setErrorMsg(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = Array.from(new Uint8Array(arrayBuffer));

      const uploaded: R2ObjectItem = await invoke("upload_r2_file_bytes", {
        sessionToken,
        targetKey,
        bytes,
        fileName: file.name,
      });

      setUploadProgress((prev) =>
        prev
          ? {
              ...prev,
              percentage: 100,
              uploaded_bytes: file.size,
              is_completed: true,
            }
          : null
      );

      setSuccessMsg(`"${uploaded.name}" Cloudflare R2'ye başarıyla yüklendi!`);
      fetchExplorer(currentPrefix);
      fetchBucketStats();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Yükleme hatası:", err);
      setErrorMsg(typeof err === "string" ? err : "Dosya yüklenirken bir hata oluştu.");
      setUploadProgress(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Güvenlik Kodu Üreticisi
  const openSecurityDeleteModal = (item?: R2ObjectItem, batchKeys?: string[]) => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setSecurityCode(randomCode);
    setSecurityInput("");
    if (batchKeys && batchKeys.length > 0) {
      setBatchToDelete(batchKeys);
      setItemToDelete(null);
    } else if (item) {
      setItemToDelete(item);
      setBatchToDelete(null);
    }
  };

  // Güvenlik Kodlu Dosya / Klasör Silme
  const handleExecuteSecureDelete = async () => {
    if (securityInput.trim() !== securityCode) {
      setErrorMsg("Güvenlik onay kodu hatalı! Lütfen ekranda yazan 6 haneli kodu eksiksiz girin.");
      return;
    }

    setDeleting(true);
    setErrorMsg(null);

    try {
      if (batchToDelete && batchToDelete.length > 0) {
        const deletedCount: number = await invoke("batch_delete_r2_objects", {
          sessionToken,
          keys: batchToDelete,
        });
        setSuccessMsg(`${deletedCount} adet dosya Cloudflare R2'den başarıyla silindi.`);
        setBatchToDelete(null);
        setSelectedKeys(new Set());
      } else if (itemToDelete) {
        await invoke("delete_r2_object", {
          sessionToken,
          key: itemToDelete.key,
        });
        setSuccessMsg(`"${itemToDelete.name}" R2 depolamasından kalıcı olarak silindi.`);
        setItemToDelete(null);
        if (selectedFile?.key === itemToDelete.key) {
          setSelectedFile(null);
        }
      }
      fetchExplorer(currentPrefix);
      fetchBucketStats();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(typeof err === "string" ? err : "Silme işlemi sırasında hata oluştu.");
    } finally {
      setDeleting(false);
    }
  };

  // Yeniden Adlandırma & Taşıma Başlatma
  const openRenameModal = (key: string, name: string, isFolder: boolean = false) => {
    setItemToRenameOrMove({ key, currentName: name, isFolder });
    setNewNameInput(name);
    // Mevcut klasör yolunu belirle
    const parts = key.split("/");
    parts.pop(); // dosya adını çıkar
    setNewFolderInput(parts.join("/"));
  };

  // Yeniden Adlandırma & Taşıma Yürütme
  const handleExecuteRenameOrMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToRenameOrMove) return;

    const cleanNewName = newNameInput.trim();
    if (!cleanNewName) {
      setErrorMsg("Dosya adı boş olamaz.");
      return;
    }

    let targetDir = newFolderInput.trim().replace(/^\/+|\/+$/g, "");
    let newKey = targetDir ? `${targetDir}/${cleanNewName}` : cleanNewName;

    if (itemToRenameOrMove.isFolder && !newKey.endsWith("/")) {
      newKey += "/";
    }

    if (newKey === itemToRenameOrMove.key) {
      setItemToRenameOrMove(null);
      return;
    }

    setRenaming(true);
    setErrorMsg(null);

    try {
      await invoke("rename_or_move_r2_object", {
        sessionToken,
        fromKey: itemToRenameOrMove.key,
        toKey: newKey,
      });

      setSuccessMsg(`"${itemToRenameOrMove.currentName}" başarıyla "${newKey}" olarak taşındı/yeniden adlandırıldı.`);
      setItemToRenameOrMove(null);
      fetchExplorer(currentPrefix);
      fetchBucketStats();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(typeof err === "string" ? err : "Taşıma/yeniden adlandırma başarısız oldu.");
    } finally {
      setRenaming(false);
    }
  };

  // Arşiv İçeriği İnceleme
  const handleInspectArchive = async (file: R2ObjectItem) => {
    setArchiveTarget(file);
    setArchiveInspectData(null);
    setLoadingArchive(true);
    setErrorMsg(null);
    setArchiveFilter("");

    try {
      const res: ArchiveInspectResult = await invoke("inspect_r2_archive", {
        sessionToken,
        key: file.key,
      });
      setArchiveInspectData(res);
    } catch (err: any) {
      console.error("Arşiv inceleme hatası:", err);
      setErrorMsg(typeof err === "string" ? err : "Arşiv içeriği incelenemedi.");
      setArchiveTarget(null);
    } finally {
      setLoadingArchive(false);
    }
  };

  // XenForo Konu Açma Modalı Başlatma
  const handleOpenForumThreadModal = async (file: R2ObjectItem) => {
    setForumThreadTarget(file);
    setThreadResult(null);

    // Otomatik başlık ve açıklama şablonu
    const cleanGameName = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[-_]/g, " ")
      .trim();

    setThreadTitle(`[TR YAMA] ${cleanGameName}`);

    const template = `[CENTER]
[B][SIZE=6]${cleanGameName} Türkçe Yama[/SIZE][/B]

[B]Proje / Yama Detayları:[/B]
• Dosya Adı: [B]${file.name}[/B]
• Dosya Boyutu: [B]${file.size_formatted}[/B]
• Güncelleme Tarihi: [B]${file.last_modified ? file.last_modified.split("T")[0] : "Güncel"}[/B]
• Dağıtım Sunucusu: [B]TurkceYama.org Hızlı CDN[/B]

[HR][/HR]
[B][SIZE=4]Kurulum Talimatları[/SIZE][/B]
1. İndirdiğiniz arşiv dosyasını masaüstüne çıkartın.
2. Oyunun kurulu olduğu dizini açın.
3. Çıkarttığınız yama dosyalarını ana dizine kopyalayın ve mevcut dosyalarla değiştirilmesini onaylayın.
4. Oyuna giriş yaparak ayarlar menüsünden Türkçe altyazı seçeneğini aktif edin.
[HR][/HR]

[URL=${file.download_url}][B][SIZE=5]⬇ ${file.name} Hemen İndir[/SIZE][/B][/URL]
[/CENTER]`;

    setThreadMessage(template);

    // XenForo kategorilerini yükle
    if (forumCategories.length === 0) {
      setLoadingCategories(true);
      try {
        const nodes: SimpleForumNode[] = await invoke("get_forum_categories");
        setForumCategories(nodes);
        if (nodes.length > 0) {
          setSelectedNodeId(nodes[0].node_id);
        }
      } catch (err) {
        console.warn("Forum kategorileri alınamadı:", err);
      } finally {
        setLoadingCategories(false);
      }
    }
  };

  // XenForo Konuyu Yayınlama
  const handlePublishForumThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNodeId || !threadTitle.trim() || !threadMessage.trim()) {
      setErrorMsg("Lütfen forum kategorisi, başlık ve mesaj alanlarını doldurun.");
      return;
    }

    setPostingThread(true);
    setErrorMsg(null);

    try {
      const res: CreateThreadResult = await invoke("create_forum_thread", {
        sessionToken,
        nodeId: selectedNodeId,
        title: threadTitle.trim(),
        message: threadMessage.trim(),
      });

      setThreadResult(res);
      setSuccessMsg("Yama konusu TurkceYama.org forumunda başarıyla yayınlandı!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("XenForo konu açma hatası:", err);
      setErrorMsg(typeof err === "string" ? err : "Forum konusu açılamadı.");
    } finally {
      setPostingThread(false);
    }
  };

  // Görsel ve Metin Önizleme
  const handleInstantPreview = async (file: R2ObjectItem) => {
    const ext = file.extension.toLowerCase();
    if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) {
      setPreviewImage(file);
    } else if (["txt", "json", "md", "log", "xml", "yml", "ini", "cfg"].includes(ext)) {
      setLoadingPreview(true);
      try {
        const resp = await fetch(file.download_url);
        const text = await resp.text();
        setPreviewText({ file, content: text });
      } catch (err) {
        setErrorMsg("Önizleme metni sunucudan okunamadı.");
      } finally {
        setLoadingPreview(false);
      }
    } else if (["zip", "rar", "7z"].includes(ext)) {
      handleInspectArchive(file);
    } else {
      setSelectedFile(file);
    }
  };

  // Toplu Seçim Yardımcıları
  const toggleSelectAll = () => {
    if (selectedKeys.size === filteredFiles.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(filteredFiles.map((f) => f.key)));
    }
  };

  const toggleSelectRow = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedKeys(next);
  };

  const handleCopyBatchURLs = () => {
    const urls = filteredFiles
      .filter((f) => selectedKeys.has(f.key))
      .map((f) => f.download_url)
      .join("\n");
    navigator.clipboard.writeText(urls);
    setSuccessMsg(`${selectedKeys.size} adet indirme bağlantısı panoya kopyalandı.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleCopyBatchBBCodes = () => {
    const bbcodes = filteredFiles
      .filter((f) => selectedKeys.has(f.key))
      .map((f) => f.bbcode)
      .join("\n");
    navigator.clipboard.writeText(bbcodes);
    setSuccessMsg(`${selectedKeys.size} adet forum BBCode panoya kopyalandı.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const copyToClipboard = (text: string, key: string, type: "url" | "bbcode") => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setCopiedType(type);
    setTimeout(() => {
      setCopiedKey(null);
      setCopiedType(null);
    }, 2000);
  };

  const getFileIcon = (category: string, _ext?: string) => {
    switch (category) {
      case "archive":
        return <FileArchive className="w-5 h-5 text-amber-400" />;
      case "executable":
        return <Package className="w-5 h-5 text-cyan-400" />;
      case "document":
        return <FileText className="w-5 h-5 text-emerald-400" />;
      case "image":
        return <FileImage className="w-5 h-5 text-pink-400" />;
      case "data":
        return <FileSpreadsheet className="w-5 h-5 text-purple-400" />;
      default:
        return <File className="w-5 h-5 text-gray-400" />;
    }
  };

  // Filtrelenmiş Dosyalar
  const filteredFiles = (explorerData?.files || []).filter((file) => {
    const matchSearch =
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.key.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = categoryFilter === "all" || file.file_category === categoryFilter;
    return matchSearch && matchCategory;
  });

  // Filtrelenmiş Klasörler
  const filteredFolders = (explorerData?.folders || []).filter((folder) =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20">
      {/* 1. ÜST BAŞLIK & METRİKLER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#14171f] border border-[#2b303c] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-[#d4af37]/10 to-transparent pointer-events-none" />

        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37]">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-wide">
                  R2 Bulut Depolama & Dosya Gezgini
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                  CANLI S3
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Bucket: <strong className="text-gray-200">{explorerData?.bucket_name || "turkceyama"}</strong> • CDN:{" "}
                <span className="text-[#d4af37] font-mono">{explorerData?.custom_domain || "https://indir.turkceyama.org"}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Aksiyon Butonları */}
        <div className="flex items-center gap-2.5 shrink-0 z-10 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            className="hidden"
          />

          <button
            onClick={() => setShowStatsCard(!showStatsCard)}
            className={`flex items-center gap-1.5 px-3 py-2.5 border rounded-xl text-xs font-medium transition cursor-pointer ${
              showStatsCard
                ? "bg-[#d4af37]/15 border-[#d4af37]/40 text-[#d4af37]"
                : "bg-[#1b202c] border-[#2e3649] text-gray-400 hover:text-white"
            }`}
            title="Depolama ve CDN İstatistiklerini Göster/Gizle"
          >
            <BarChart3 className="w-4 h-4" />
            <span>İstatistikler</span>
          </button>

          <button
            data-tour="upload-zone"
            onClick={handlePickAndUploadFile}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#d4af37] hover:bg-[#b8952b] text-black font-semibold rounded-xl text-xs transition shadow-md shadow-[#d4af37]/20 cursor-pointer disabled:opacity-50"
            title="Windows Gezgini ile dosya seç (GB'larca büyük yama dosyaları desteklenir)"
          >
            <Upload className="w-4 h-4" />
            <span>{uploading ? "Yükleniyor..." : "Dosya Yükle (Sınırsız GB)"}</span>
          </button>

          <button
            onClick={() => setShowFolderModal(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-[#1b202c] hover:bg-[#252c3d] border border-[#2e3649] text-gray-200 hover:text-white rounded-xl text-xs font-medium transition cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-[#d4af37]" />
            <span>Yeni Klasör</span>
          </button>

          <button
            onClick={() => {
              fetchExplorer(currentPrefix);
              fetchBucketStats();
            }}
            disabled={loading}
            className="p-2.5 bg-[#1b202c] hover:bg-[#252c3d] border border-[#2e3649] text-gray-400 hover:text-white rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#d4af37]" : ""}`} />
          </button>
        </div>
      </div>

      {/* İSTATİSTİKLER & CDN TRAFİK TÜKETİMİ PANOSU */}
      {showStatsCard && bucketStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#14171f] border border-[#2b303c] rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-semibold">Toplam Dosya</div>
              <div className="text-xl font-bold text-white mt-1 font-mono">{bucketStats.total_files}</div>
              <div className="text-[10px] text-emerald-400 mt-0.5">Aktif Dağıtımda</div>
            </div>
            <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/20 text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#14171f] border border-[#2b303c] rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-semibold">Toplam Depolama</div>
              <div className="text-xl font-bold text-[#d4af37] mt-1 font-mono">{bucketStats.total_size_formatted}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Cloudflare R2 Bucket</div>
            </div>
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/20 text-[#d4af37]">
              <Cloud className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#14171f] border border-[#2b303c] rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-semibold">Tahmini CDN Trafiği</div>
              <div className="text-xl font-bold text-cyan-400 mt-1 font-mono">{bucketStats.estimated_monthly_bandwidth}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Aylık Rotasyon Tahmini</div>
            </div>
            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/20 text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#14171f] border border-[#2b303c] rounded-xl p-4 flex flex-col justify-between shadow-sm">
            <div className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Kategori Dağılımı</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {bucketStats.category_breakdown.slice(0, 3).map((c) => (
                <span
                  key={c.category}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-[#1c2230] border border-[#2e374d] text-gray-300 font-mono"
                  title={`${c.count} dosya - ${c.total_formatted}`}
                >
                  {c.category}: <strong className="text-[#d4af37]">{c.total_formatted}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SÜRÜKLE-BIRAK VE YÜKSEK BOYUT BİLGİ BANDI */}
      <div className="bg-[#14171f]/80 border border-[#2b303c] rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#d4af37] shrink-0" />
          <span>
            <strong className="text-gray-200">S3 Multipart (Parçalı) Akış Desteği:</strong> Çok parçalı GB'larca yama dosyalarını tek seferde R2'ye yükleyin, arşiv içeriklerini tek tıkla inceleyin ve foruma direkt konu açın.
          </span>
        </div>
        <button
          onClick={handlePickAndUploadFile}
          disabled={uploading}
          className="text-[11px] text-[#d4af37] hover:underline font-semibold cursor-pointer shrink-0 ml-2"
        >
          Dosya Seç ➔
        </button>
      </div>

      {/* CANLI ANİMASYONLU İÇ (INLINE) YÜKLEME KARTI */}
      {uploadProgress && (
        <InlineUploadCard
          uploadState={uploadProgress}
          onClose={() => {
            setUploadProgress(null);
            setUploading(false);
          }}
          onOpenForumThread={(fName, tKey) => {
            const ext = fName.split(".").pop()?.toLowerCase() || "";
            const mockFile: R2ObjectItem = {
              key: tKey,
              name: fName,
              size_bytes: uploadProgress.total_bytes,
              size_formatted: "",
              last_modified: "",
              etag: "",
              download_url: `https://indir.turkceyama.org/${tKey}`,
              bbcode: `[URL=https://indir.turkceyama.org/${tKey}][B]⬇ ${fName} İndir[/B][/URL]`,
              extension: ext,
              file_category: "archive",
            };
            handleOpenForumThreadModal(mockFile);
          }}
        />
      )}

      {errorMsg && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-4 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-gray-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-gray-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. BREADCRUMB & DİZİN NAVİGASYONU */}
      <div className="bg-[#14171f] border border-[#2b303c] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {explorerData?.parent_prefix !== undefined && explorerData.parent_prefix !== null && (
            <button
              onClick={() => handleNavigate(explorerData.parent_prefix || "")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1c2230] hover:bg-[#252c3e] border border-[#2e374d] text-gray-300 hover:text-white font-medium cursor-pointer transition mr-1"
              title="Bir Üst Klasöre Çık"
            >
              <ArrowUp className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Üst Dizin</span>
            </button>
          )}

          {explorerData?.breadcrumbs.map((bc, idx) => {
            const isLast = idx === explorerData.breadcrumbs.length - 1;
            return (
              <React.Fragment key={bc.prefix}>
                {idx > 0 && <span className="text-gray-600 font-mono">/</span>}
                <button
                  onClick={() => handleNavigate(bc.prefix)}
                  className={`px-2.5 py-1 rounded-lg transition font-mono cursor-pointer ${
                    isLast
                      ? "bg-[#d4af37]/15 text-[#d4af37] font-bold border border-[#d4af37]/30"
                      : "text-gray-400 hover:text-white hover:bg-[#1f2430]"
                  }`}
                >
                  {bc.name}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Özet Metrikler */}
        <div className="flex items-center gap-4 text-gray-400 text-[11px] font-mono shrink-0">
          <div>
            Klasör: <strong className="text-white">{explorerData?.total_folders ?? 0}</strong>
          </div>
          <div>
            Dosya: <strong className="text-white">{explorerData?.total_files ?? 0}</strong>
          </div>
          <div>
            Toplam: <strong className="text-[#d4af37]">{explorerData?.total_size_formatted ?? "0 B"}</strong>
          </div>
        </div>
      </div>

      {/* 3. ARAMA VE FİLTRE ÇUBUĞU */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Arama */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Dosya veya klasör ara..."
            className="w-full pl-9 pr-3 py-2 bg-[#14171f] border border-[#2b303c] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d4af37]/50"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Kategori Filtresi */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: "all", label: "Tümü" },
            { id: "archive", label: "Arşivler (.zip, .rar)" },
            { id: "executable", label: "Kurulum (.exe)" },
            { id: "data", label: "Yama / Veri" },
            { id: "document", label: "Belgeler" },
            { id: "image", label: "Görseller" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                categoryFilter === cat.id
                  ? "bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40 font-semibold"
                  : "bg-[#14171f] text-gray-400 hover:text-white border border-[#2b303c]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. İÇERİK: KLASÖRLER & DOSYALAR */}
      {loading ? (
        <div className="p-16 text-center text-gray-500 bg-[#14171f] border border-[#2b303c] rounded-2xl">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#d4af37] mb-3" />
          <div className="text-sm font-medium text-gray-300">Cloudflare R2 nesneleri taranıyor...</div>
          <div className="text-xs text-gray-500 mt-1">Dizin yapısı ve dosya meta verileri alınıyor.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* KLASÖRLER IZGARASI */}
          {filteredFolders.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Klasörler ({filteredFolders.length})</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {filteredFolders.map((folder) => (
                  <div
                    key={folder.prefix}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#14171f] hover:bg-[#1c2230] border border-[#2b303c] hover:border-[#d4af37]/40 transition text-left group shadow-sm"
                  >
                    <button
                      onClick={() => handleNavigate(folder.prefix)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer text-left"
                    >
                      <Folder className="w-5 h-5 text-[#d4af37] shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold text-gray-200 group-hover:text-white truncate">
                        {folder.name}
                      </span>
                    </button>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openRenameModal(folder.prefix, folder.name, true);
                        }}
                        className="p-1 rounded-lg hover:bg-[#252c3d] text-gray-400 hover:text-white transition cursor-pointer"
                        title="Klasörü Yeniden Adlandır / Taşı"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {isSuperAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openSecurityDeleteModal({
                              key: folder.prefix,
                              name: `${folder.name}/ (Klasör ve Tüm İçeriği)`,
                              size_bytes: 0,
                              size_formatted: "Klasör",
                              last_modified: "-",
                              etag: "",
                              download_url: "",
                              bbcode: "",
                              extension: "folder",
                              file_category: "folder",
                            });
                          }}
                          className="p-1 rounded-lg hover:bg-rose-950/60 text-rose-400 hover:text-rose-200 transition cursor-pointer"
                          title="Klasörü ve İçeriğini Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DOSYALAR TABLOSU */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Dosyalar ({filteredFiles.length})</span>
              </div>

              {filteredFiles.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="text-[11px] text-gray-400 hover:text-white font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  {selectedKeys.size === filteredFiles.length ? (
                    <>
                      <CheckSquare className="w-3.5 h-3.5 text-[#d4af37]" />
                      <span>Seçimi Kaldır</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5" />
                      <span>Tümünü Seç ({filteredFiles.length})</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {filteredFiles.length === 0 ? (
              <div className="p-12 text-center text-gray-500 bg-[#14171f] border border-[#2b303c] rounded-2xl">
                <Folder className="w-10 h-10 mx-auto text-gray-600 mb-2 opacity-50" />
                <div className="text-sm font-semibold text-gray-300">Bu klasörde görüntülenecek dosya yok</div>
                <div className="text-xs text-gray-500 mt-1">
                  Yukarıdaki "Dosya Yükle" butonuyla bu dizine doğrudan yeni yama yükleyebilirsiniz.
                </div>
              </div>
            ) : (
              <div className="bg-[#14171f] border border-[#2b303c] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#2b303c] bg-[#11131a] text-gray-400 font-semibold text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-3 w-10 text-center">
                          <button
                            onClick={toggleSelectAll}
                            className="cursor-pointer text-gray-400 hover:text-white"
                          >
                            {selectedKeys.size > 0 && selectedKeys.size === filteredFiles.length ? (
                              <CheckSquare className="w-4 h-4 text-[#d4af37]" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </th>
                        <th className="py-3 px-4">Dosya Adı</th>
                        <th className="py-3 px-4">Boyut</th>
                        <th className="py-3 px-4">Son Güncelleme</th>
                        <th className="py-3 px-4">Tür</th>
                        <th className="py-3 px-4 text-right">Eylemler & Entegrasyon</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232733]">
                      {filteredFiles.map((file) => {
                        const isSelected = selectedKeys.has(file.key);
                        const isArchive = ["zip", "rar", "7z"].includes(file.extension.toLowerCase());
                        const isImage = ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(file.extension.toLowerCase());
                        const isText = ["txt", "json", "md", "log", "xml", "yml", "ini"].includes(file.extension.toLowerCase());

                        return (
                          <tr
                            key={file.key}
                            className={`transition group ${
                              isSelected ? "bg-[#d4af37]/10" : "hover:bg-[#1a1e28]"
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => toggleSelectRow(file.key)}
                                className="cursor-pointer text-gray-400 hover:text-white"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-[#d4af37]" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </td>

                            {/* Dosya Adı & İkon */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="shrink-0 p-1.5 rounded-lg bg-[#1a1f2c] border border-[#2e374c]">
                                  {getFileIcon(file.file_category, file.extension)}
                                </div>
                                <div className="min-w-0">
                                  <button
                                    onClick={() => handleInstantPreview(file)}
                                    className="text-xs font-semibold text-gray-100 hover:text-[#d4af37] transition text-left truncate block max-w-md cursor-pointer"
                                    title={file.name}
                                  >
                                    {file.name}
                                  </button>
                                  <div className="text-[10px] text-gray-500 font-mono truncate max-w-xs">
                                    {file.key}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Boyut */}
                            <td className="py-3 px-4 text-gray-300 font-mono font-medium whitespace-nowrap">
                              {file.size_formatted}
                            </td>

                            {/* Tarih */}
                            <td className="py-3 px-4 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                              {file.last_modified ? file.last_modified.split("T")[0] : "-"}
                            </td>

                            {/* Uzantı / Kategori */}
                            <td className="py-3 px-4">
                              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-[#1e2330] border border-[#2d3548] text-gray-300 font-semibold">
                                {file.extension || "dosya"}
                              </span>
                            </td>

                            {/* Eylemler */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Arşiv İnceleme Butonu */}
                                {isArchive && (
                                  <button
                                    data-tour="archive-inspector"
                                    onClick={() => handleInspectArchive(file)}
                                    className="p-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-300 hover:text-white transition cursor-pointer"
                                    title="Arşiv İçeriğini İncele (İndirmeden Tabloyu Gör)"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Önizleme Butonu (Görsel veya Metin) */}
                                {(isImage || isText) && (
                                  <button
                                    onClick={() => handleInstantPreview(file)}
                                    className="p-1.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 hover:text-white transition cursor-pointer"
                                    title="Anında Önizle"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Foruma Konu Aç Butonu */}
                                <button
                                  data-tour="forum-thread"
                                  onClick={() => handleOpenForumThreadModal(file)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-950/50 hover:bg-blue-900/70 border border-blue-500/30 text-[10px] font-bold text-blue-300 hover:text-white transition cursor-pointer"
                                  title="TurkceYama.org Forumunda Doğrudan Konu Aç"
                                >
                                  <MessageSquarePlus className="w-3.5 h-3.5" />
                                  <span>Konu Aç</span>
                                </button>

                                {/* Yeniden Adlandır / Taşı */}
                                <button
                                  onClick={() => openRenameModal(file.key, file.name, false)}
                                  className="p-1.5 rounded-lg bg-[#1b202c] hover:bg-[#252c3d] border border-[#2e3649] text-gray-300 hover:text-white transition cursor-pointer"
                                  title="Yeniden Adlandır veya Klasöre Taşı"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                {/* CDN URL Kopyala */}
                                <button
                                  onClick={() => copyToClipboard(file.download_url, file.key, "url")}
                                  className="p-1.5 rounded-lg bg-[#1b202c] hover:bg-[#252c3d] border border-[#2e3649] text-gray-300 hover:text-white transition cursor-pointer"
                                  title="İndirme Linkini (CDN) Kopyala"
                                >
                                  {copiedKey === file.key && copiedType === "url" ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                {/* BBCode Kopyala */}
                                <button
                                  onClick={() => copyToClipboard(file.bbcode, file.key, "bbcode")}
                                  className="px-2 py-1 rounded-lg bg-[#1b202c] hover:bg-[#252c3d] border border-[#2e3649] text-[10px] font-mono font-bold text-[#d4af37] hover:text-white transition cursor-pointer"
                                  title="Forum BBCode Linkini Kopyala"
                                >
                                  {copiedKey === file.key && copiedType === "bbcode" ? (
                                    <span className="text-emerald-400">Kopyalandı!</span>
                                  ) : (
                                    "BBCode"
                                  )}
                                </button>

                                {/* Tarayıcıda Aç / İndir */}
                                <a
                                  href={file.download_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 rounded-lg bg-[#1b202c] hover:bg-[#252c3d] border border-[#2e3649] text-gray-300 hover:text-white transition"
                                  title="Tarayıcıda Aç / İndir"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>

                                {/* Sil (Yalnızca Süper Admin - Güvenlik Kodlu) */}
                                {isSuperAdmin && (
                                  <button
                                    onClick={() => openSecurityDeleteModal(file)}
                                    className="p-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 border border-rose-500/30 text-rose-400 hover:text-rose-200 transition cursor-pointer"
                                    title="R2'den Sil (Güvenlik Korumalı)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. TOPLU İŞLEM YÜZEN ÇUBUĞU (FLOATING ACTION BAR) */}
      {selectedKeys.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#161a24] border border-[#d4af37]/40 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 pr-2 border-r border-[#2b303c]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#d4af37] animate-ping" />
            <span className="text-xs font-bold text-white font-mono">
              {selectedKeys.size} dosya seçildi
            </span>
          </div>

          <button
            onClick={handleCopyBatchURLs}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#202737] hover:bg-[#2b344a] text-gray-200 hover:text-white rounded-xl text-xs font-medium cursor-pointer transition"
          >
            <Copy className="w-3.5 h-3.5 text-emerald-400" />
            <span>Linkleri Kopyala</span>
          </button>

          <button
            onClick={handleCopyBatchBBCodes}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#202737] hover:bg-[#2b344a] text-gray-200 hover:text-white rounded-xl text-xs font-medium cursor-pointer transition"
          >
            <Copy className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>BBCode Kopyala</span>
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => openSecurityDeleteModal(undefined, Array.from(selectedKeys))}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition shadow-md shadow-rose-900/30"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Seçilenleri Sil ({selectedKeys.size})</span>
            </button>
          )}

          <button
            onClick={() => setSelectedKeys(new Set())}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#202737] cursor-pointer"
            title="Seçimi Temizle"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 6. YENİ KLASÖR OLUŞTURMA MODALI */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#14171f] border border-[#2b303c] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setShowFolderModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37]">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Yeni Klasör Oluştur</h3>
                <p className="text-[11px] text-gray-400 font-mono">
                  Konum: /{currentPrefix || ""}
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Klasör Adı
                </label>
                <input
                  type="text"
                  required
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="örn: yamalar, rdr2, v1.0"
                  className="w-full px-3.5 py-2.5 bg-[#1b202c] border border-[#2e3649] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 bg-[#1b202c] hover:bg-[#252c3d] text-gray-300 rounded-xl text-xs font-medium cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={creatingFolder}
                  className="px-4 py-2 bg-[#d4af37] hover:bg-[#b8952b] text-black font-semibold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {creatingFolder ? "Oluşturuluyor..." : "Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. YENİDEN ADLANDIRMA VE TAŞIMA MODALI */}
      {itemToRenameOrMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#14171f] border border-[#2b303c] rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setItemToRenameOrMove(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-blue-950/50 border border-blue-500/30 text-blue-400">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {itemToRenameOrMove.isFolder ? "Klasörü Yeniden Adlandır / Taşı" : "Dosyayı Yeniden Adlandır / Taşı"}
                </h3>
                <p className="text-[11px] text-gray-400 font-mono truncate max-w-xs">
                  {itemToRenameOrMove.key}
                </p>
              </div>
            </div>

            <form onSubmit={handleExecuteRenameOrMove} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Yeni İsim:
                </label>
                <input
                  type="text"
                  required
                  value={newNameInput}
                  onChange={(e) => setNewNameInput(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#1b202c] border border-[#2e3649] rounded-xl text-xs text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Hedef Klasör Yolu (Boş bırakırsanız ana dizine taşınır):
                </label>
                <input
                  type="text"
                  value={newFolderInput}
                  onChange={(e) => setNewFolderInput(e.target.value)}
                  placeholder="örn: yamalar/gta5 veya boş"
                  className="w-full px-3.5 py-2 bg-[#1b202c] border border-[#2e3649] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#11131a] border border-[#242936] text-[11px] font-mono text-gray-400">
                Hedef Yol: <span className="text-[#d4af37]">{newFolderInput ? `${newFolderInput.replace(/^\/+|\/+$/g, "")}/` : ""}{newNameInput}</span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setItemToRenameOrMove(null)}
                  className="px-4 py-2 bg-[#1b202c] hover:bg-[#252c3d] text-gray-300 rounded-xl text-xs font-medium cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={renaming}
                  className="px-4 py-2 bg-[#d4af37] hover:bg-[#b8952b] text-black font-semibold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {renaming ? "Taşınıyor..." : "Uygula & Taşı"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. ARŞİV İÇERİĞİ GÖRÜNTÜLEYİCİ (ZIP/RAR INSPECTOR) */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#14171f] border border-[#2b303c] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => {
                setArchiveTarget(null);
                setArchiveInspectData(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/30 text-amber-400">
                <Archive className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white truncate max-w-lg">
                  Arşiv İçerik Tablosu: {archiveTarget.name}
                </h3>
                <p className="text-[11px] text-gray-400">
                  Arşiv indirilmeden, HTTP Range sorgusu ile doğrudan incelenmektedir.
                </p>
              </div>
            </div>

            {loadingArchive ? (
              <div className="p-16 text-center text-gray-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#d4af37] mb-3" />
                <div className="text-sm font-semibold text-white">Merkezi Dizin (Central Directory) Çözümleniyor...</div>
                <div className="text-xs text-gray-500 mt-1">Dosya listesi ve sıkıştırma oranları taranıyor.</div>
              </div>
            ) : archiveInspectData ? (
              <div className="space-y-3 flex-1 overflow-hidden flex flex-col min-h-0">
                {/* Metrik Rozetleri */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-[#11131a] p-2.5 rounded-xl border border-[#242936] text-center">
                    <div className="text-[10px] text-gray-500 uppercase font-semibold">Toplam Dosya</div>
                    <div className="text-sm font-bold text-white font-mono mt-0.5">{archiveInspectData.total_files}</div>
                  </div>
                  <div className="bg-[#11131a] p-2.5 rounded-xl border border-[#242936] text-center">
                    <div className="text-[10px] text-gray-500 uppercase font-semibold">Açılmış Boyut</div>
                    <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">{archiveInspectData.total_uncompressed_formatted}</div>
                  </div>
                  <div className="bg-[#11131a] p-2.5 rounded-xl border border-[#242936] text-center">
                    <div className="text-[10px] text-gray-500 uppercase font-semibold">Paket Boyutu</div>
                    <div className="text-sm font-bold text-[#d4af37] font-mono mt-0.5">{archiveInspectData.total_compressed_formatted}</div>
                  </div>
                  <div className="bg-[#11131a] p-2.5 rounded-xl border border-[#242936] text-center">
                    <div className="text-[10px] text-gray-500 uppercase font-semibold">Klasör Sayısı</div>
                    <div className="text-sm font-bold text-gray-300 font-mono mt-0.5">{archiveInspectData.total_dirs}</div>
                  </div>
                </div>

                {/* Filtre */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={archiveFilter}
                    onChange={(e) => setArchiveFilter(e.target.value)}
                    placeholder="Arşiv içindeki dosyalarda ara..."
                    className="w-full pl-8 pr-3 py-1.5 bg-[#171a24] border border-[#2b3142] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                {/* Tablo */}
                <div className="flex-1 overflow-y-auto border border-[#2b303c] rounded-xl bg-[#11131a]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#161a24] border-b border-[#2b303c] text-gray-400 text-[10px] uppercase font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Yol & Dosya</th>
                        <th className="py-2.5 px-3">Açılmış Boyut</th>
                        <th className="py-2.5 px-3">Sıkıştırılmış</th>
                        <th className="py-2.5 px-3 text-right">Tasarruf Oranı</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e2330] font-mono">
                      {archiveInspectData.entries
                        .filter((entry) =>
                          entry.name.toLowerCase().includes(archiveFilter.toLowerCase())
                        )
                        .map((entry, idx) => (
                          <tr key={idx} className="hover:bg-[#181d29] transition">
                            <td className="py-2 px-3 text-gray-200 break-all">
                              {entry.is_dir ? (
                                <span className="text-[#d4af37] flex items-center gap-1.5">
                                  <Folder className="w-3.5 h-3.5" />
                                  <span>{entry.name}</span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5">
                                  <File className="w-3.5 h-3.5 text-gray-400" />
                                  <span>{entry.name}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-gray-400 whitespace-nowrap">
                              {entry.is_dir ? "-" : entry.uncompressed_size_formatted}
                            </td>
                            <td className="py-2 px-3 text-gray-400 whitespace-nowrap">
                              {entry.is_dir ? "-" : entry.compressed_size_formatted}
                            </td>
                            <td className="py-2 px-3 text-right text-emerald-400 whitespace-nowrap">
                              {entry.is_dir ? "-" : entry.compression_ratio}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => {
                  setArchiveTarget(null);
                  setArchiveInspectData(null);
                }}
                className="px-4 py-2 bg-[#1b202c] hover:bg-[#252c3d] text-gray-200 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. YÜKLENİYOR ÖNİZLEME MODALI */}
      {loadingPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#14171f] border border-[#2b303c] rounded-2xl p-6 flex items-center gap-3 text-white text-xs shadow-2xl">
            <RefreshCw className="w-5 h-5 animate-spin text-[#d4af37]" />
            <span>Dosya önizleme içeriği okunuyor...</span>
          </div>
        </div>
      )}

      {/* 9. GÖRSEL ÖNİZLEME MODALI */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#14171f] border border-[#2b303c] rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <FileImage className="w-5 h-5 text-pink-400" />
              <h3 className="text-sm font-bold text-white truncate max-w-md">{previewImage.name}</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#1e2330] text-gray-300">
                {previewImage.size_formatted}
              </span>
            </div>

            <div className="bg-[#0b0d13] rounded-xl border border-[#232836] p-2 flex items-center justify-center max-h-[60vh] overflow-hidden">
              <img
                src={previewImage.download_url}
                alt={previewImage.name}
                className="max-h-[55vh] max-w-full object-contain rounded-lg"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-gray-400 font-mono truncate max-w-xs">{previewImage.download_url}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(previewImage.download_url, "preview-url", "url")}
                  className="px-3 py-1.5 rounded-xl bg-[#1b202c] hover:bg-[#252c3d] text-xs font-medium text-gray-200 cursor-pointer"
                >
                  Link Kopyala
                </button>
                <a
                  href={previewImage.download_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-[#d4af37] text-black text-xs font-semibold cursor-pointer"
                >
                  Orijinal Boyutta Aç
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. METİN / KOD ÖNİZLEME MODALI */}
      {previewText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#14171f] border border-[#2b303c] rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setPreviewText(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white truncate max-w-md">{previewText.file.name}</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#1e2330] text-gray-300">
                {previewText.file.size_formatted}
              </span>
            </div>

            <pre className="flex-1 overflow-y-auto bg-[#0b0d13] p-4 rounded-xl border border-[#232836] font-mono text-xs text-gray-300 whitespace-pre-wrap select-all">
              {previewText.content}
            </pre>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(previewText.content);
                  setSuccessMsg("Tüm metin panoya kopyalandı.");
                  setTimeout(() => setSuccessMsg(null), 2500);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#1b202c] hover:bg-[#252c3d] text-xs font-medium text-gray-200 cursor-pointer"
              >
                Metni Kopyala
              </button>
              <button
                onClick={() => setPreviewText(null)}
                className="px-4 py-1.5 bg-[#d4af37] text-black text-xs font-semibold rounded-xl cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. XENFORO FORUMDA KONU AÇMA MODALI */}
      {forumThreadTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#14171f] border border-blue-500/40 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => {
                setForumThreadTarget(null);
                setThreadResult(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-500/40 text-blue-400">
                <MessageSquarePlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  TurkceYama.org Forumunda Konu Aç
                </h3>
                <p className="text-[11px] text-gray-400">
                  Dosya indirme linki ve BBCode şablonu otomatik olarak hazırlanır.
                </p>
              </div>
            </div>

            {threadResult ? (
              <div className="p-6 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-base font-bold text-white">Konu Başarıyla Yayınlandı!</h4>
                <p className="text-xs text-emerald-300">{threadResult.message}</p>
                <div className="pt-2">
                  <a
                    href={threadResult.view_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#d4af37] hover:bg-[#b8952b] text-black font-bold rounded-xl text-xs transition shadow-lg cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Konuyu Forumda Görüntüle ➔</span>
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePublishForumThread} className="space-y-3 flex-1 overflow-y-auto pr-1">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Forum / Kategori Seçin:
                  </label>
                  {loadingCategories ? (
                    <div className="text-xs text-gray-500 py-2">Kategoriler yükleniyor...</div>
                  ) : (
                    <select
                      value={selectedNodeId}
                      onChange={(e) => setSelectedNodeId(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-[#1b202c] border border-[#2e3649] rounded-xl text-xs text-white focus:outline-none focus:border-[#d4af37]"
                    >
                      {forumCategories.map((cat) => (
                        <option key={cat.node_id} value={cat.node_id}>
                          {cat.title} (ID: {cat.node_id})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Konu Başlığı:
                  </label>
                  <input
                    type="text"
                    required
                    value={threadTitle}
                    onChange={(e) => setThreadTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#1b202c] border border-[#2e3649] rounded-xl text-xs text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Mesaj İçeriği (BBCode):
                  </label>
                  <textarea
                    rows={8}
                    required
                    value={threadMessage}
                    onChange={(e) => setThreadMessage(e.target.value)}
                    className="w-full p-3 bg-[#11131a] border border-[#242936] rounded-xl text-xs text-gray-200 font-mono focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setForumThreadTarget(null)}
                    className="px-4 py-2 bg-[#1b202c] hover:bg-[#252c3d] text-gray-300 rounded-xl text-xs font-medium cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={postingThread || loadingCategories}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50 shadow-md shadow-blue-900/30"
                  >
                    {postingThread ? "Yayınlanıyor..." : "Konuyu Forumda Yayınla"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 12. GÜVENLİK PROTOKOLÜ: DOSYA VE TOPLU SİLME ONAY MODALI */}
      {(itemToDelete || batchToDelete) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#14171f] border border-rose-500/50 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Güvenlik Onay Protokolü</h3>
                <p className="text-xs text-rose-400 font-medium mt-0.5">
                  {batchToDelete
                    ? `${batchToDelete.length} adet dosya kalıcı olarak silinecek!`
                    : "Bu işlem geri alınamaz!"}
                </p>
              </div>
            </div>

            <div className="text-xs text-gray-300 bg-[#11131a] p-3 rounded-xl border border-[#2b303c] font-mono break-all max-h-32 overflow-y-auto">
              {batchToDelete ? (
                <div>
                  <strong className="text-rose-400">Silinecek Dosyalar ({batchToDelete.length}):</strong>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px] text-gray-400">
                    {batchToDelete.map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                itemToDelete?.key
              )}
            </div>

            <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-rose-300 font-semibold">
                <Lock className="w-4 h-4" />
                <span>Yanlışlıkla Silmeyi Önleme Kodu</span>
              </div>
              <p className="text-[11px] text-gray-400">
                Silme işlemini onaylamak için lütfen aşağıdaki <strong className="text-white font-mono text-xs">{securityCode}</strong> kodunu kutucuğa yazın:
              </p>
              <input
                type="text"
                autoFocus
                value={securityInput}
                onChange={(e) => setSecurityInput(e.target.value)}
                placeholder={`Onay kodu: ${securityCode}`}
                className="w-full px-3 py-2 bg-[#1b202c] border border-[#2e3649] rounded-xl text-center text-sm font-mono tracking-widest text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setItemToDelete(null);
                  setBatchToDelete(null);
                }}
                className="px-4 py-2 bg-[#1b202c] hover:bg-[#252c3d] text-gray-300 rounded-xl text-xs font-medium cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleExecuteSecureDelete}
                disabled={deleting || securityInput.trim() !== securityCode}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-rose-950/50"
              >
                {deleting ? "Siliniyor..." : "Onayla ve Kalıcı Olarak Sil"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 13. DOSYA DETAY & İNCELEME MODALI */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#14171f] border border-[#2b303c] rounded-2xl w-full max-w-xl p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setSelectedFile(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[#1b202c] border border-[#2e3649]">
                {getFileIcon(selectedFile.file_category, selectedFile.extension)}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white truncate max-w-md">
                  {selectedFile.name}
                </h3>
                <div className="text-[11px] text-gray-400 font-mono">
                  {selectedFile.size_formatted} • {selectedFile.extension.toUpperCase()}
                </div>
              </div>
            </div>

            <div className="space-y-3 bg-[#11131a] p-4 rounded-xl border border-[#242936] text-xs">
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                  Cloudflare R2 Tam Anahtarı (Key)
                </div>
                <div className="font-mono text-gray-300 bg-[#171a24] p-2 rounded-lg break-all select-all border border-[#2b3142]">
                  {selectedFile.key}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                  Doğrudan CDN İndirme Bağlantısı
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-[#d4af37] bg-[#171a24] p-2 rounded-lg break-all flex-1 select-all border border-[#2b3142]">
                    {selectedFile.download_url}
                  </div>
                  <button
                    onClick={() => copyToClipboard(selectedFile.download_url, "modal-url", "url")}
                    className="p-2 rounded-lg bg-[#222838] hover:bg-[#2d3549] text-gray-300 hover:text-white border border-[#333d53] cursor-pointer"
                    title="Kopyala"
                  >
                    {copiedKey === "modal-url" ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                  XenForo Uyumlu BBCode (Forum Konuları İçin)
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-gray-300 bg-[#171a24] p-2 rounded-lg break-all flex-1 select-all border border-[#2b3142]">
                    {selectedFile.bbcode}
                  </div>
                  <button
                    onClick={() => copyToClipboard(selectedFile.bbcode, "modal-bb", "bbcode")}
                    className="p-2 rounded-lg bg-[#222838] hover:bg-[#2d3549] text-gray-300 hover:text-white border border-[#333d53] cursor-pointer"
                    title="BBCode Kopyala"
                  >
                    {copiedKey === "modal-bb" ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase font-semibold">Son Düzenleme</div>
                  <div className="font-mono text-gray-300 mt-0.5">{selectedFile.last_modified || "Bilinmiyor"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase font-semibold">ETag / Sağlama</div>
                  <div className="font-mono text-gray-300 mt-0.5 truncate">{selectedFile.etag || "-"}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href={selectedFile.download_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-[#d4af37] hover:bg-[#b8952b] text-black font-semibold rounded-xl text-xs transition"
              >
                <Download className="w-4 h-4" />
                <span>Tarayıcıda İndir</span>
              </a>

              {isSuperAdmin && (
                <button
                  onClick={() => openSecurityDeleteModal(selectedFile)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-950/30 hover:bg-rose-900/50 border border-rose-500/30 text-rose-400 hover:text-rose-200 rounded-xl text-xs font-medium cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Dosyayı Sil</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
