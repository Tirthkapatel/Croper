document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Management ---
    function initTheme() {
        const localTheme = localStorage.getItem('themePref');
        const sysTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = localTheme === 'dark' || (!localTheme && sysTheme);
        
        applyTheme(isDark ? 'dark' : 'light');

        // Add transition class after a short delay to prevent FOUC fade
        setTimeout(() => {
            document.body.classList.add('theme-transition');
        }, 100);

        // Bind toggle buttons
        const navToggle = document.getElementById('theme-toggle-btn');
        const settingsToggle = document.getElementById('settings-theme-toggle');
        
        const toggleHandler = () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
            localStorage.setItem('themePref', newTheme);
        };

        if (navToggle) navToggle.addEventListener('click', toggleHandler);
        if (settingsToggle) settingsToggle.addEventListener('click', toggleHandler);
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('theme-color-meta').setAttribute('content', '#0f172a');
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.getElementById('theme-color-meta').setAttribute('content', '#F8F9FB');
        }
        
        // Update Icons
        const moonIcon = document.querySelector('.moon-icon');
        const sunIcon = document.querySelector('.sun-icon');
        if (moonIcon && sunIcon) {
            if (theme === 'dark') {
                moonIcon.classList.add('hidden');
                sunIcon.classList.remove('hidden');
            } else {
                sunIcon.classList.add('hidden');
                moonIcon.classList.remove('hidden');
            }
        }
    }

    initTheme();

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    
    const statusSection = document.getElementById('status-section');
    const resultSection = document.getElementById('result-section');
    const resultDetails = document.getElementById('result-details');
    
    const downloadBtn = document.getElementById('download-btn');
    const processMoreBtn = document.getElementById('process-more-btn');

    const settingsSection = document.getElementById('settings-section');
    const previewSection = document.getElementById('preview-section');
    const pdfPreview = document.getElementById('pdf-preview');

    let currentInputBuffer = null;
    let previewUrl = null;
    let processedPdfBytes = null;

    // --- Event Listeners for Upload ---
    browseBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });

    // --- Action Buttons ---
    downloadBtn.addEventListener('click', () => {
        if (previewUrl) {
            const a = document.createElement('a');
            a.href = previewUrl;
            a.download = 'FINAL_CROPPED_LABEL.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    });

    processMoreBtn.addEventListener('click', () => {
        resultSection.classList.add('hidden');
        previewSection.classList.add('hidden');
        dropZone.classList.remove('hidden');
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.remove('animate-in');
            setTimeout(() => sidebar.classList.remove('visible'), 500);
        }
        
        // Reset platform selection
        const platformOptions = document.querySelectorAll('.platform-option');
        if (platformOptions) {
            platformOptions.forEach(opt => opt.classList.remove('selected'));
        }
        const platformRadios = document.querySelectorAll('input[name="platform"]');
        if (platformRadios) {
            platformRadios.forEach(radio => radio.checked = false);
        }
        const meeshoOptions = document.getElementById('meesho-options');
        if (meeshoOptions) meeshoOptions.style.display = 'none';
        
        const headerTitle = document.getElementById('app-main-title');
        if (headerTitle) {
            headerTitle.innerText = `Multi-Platform Label Cropper`;
        }

        fileInput.value = '';
        processedPdfBytes = null;
        currentInputBuffer = null;
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
            pdfPreview.src = '';
        }
    });

    // --- Progress Helper ---
    function updateProgress(percent, text, subtext) {
        const fill = document.getElementById('progress-bar-fill');
        const pctText = document.getElementById('progress-percent');
        const stText = document.getElementById('status-text');
        const stSubText = document.getElementById('status-subtext');
        if (fill) fill.style.width = Math.min(100, Math.max(0, percent)) + '%';
        if (pctText) pctText.innerText = Math.round(percent) + '%';
        if (stText && text) stText.innerText = text;
        if (stSubText && subtext) stSubText.innerText = subtext;
    }

    // --- Core Logic ---
    async function handleFiles(files) {
        const validFiles = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
        if (validFiles.length === 0) {
            showToast("Please upload a valid PDF file.", "error");
            return;
        }

        dropZone.classList.add('hidden');
        statusSection.classList.remove('hidden');
        updateProgress(0, "Preparing files...", "Waiting for processing settings...");
        
        // Show Sidebar and Skeleton Loader immediately
        const sidebar = document.getElementById('sidebar');
        const skeletonLoader = document.getElementById('skeleton-loader');
        const summaryList = document.getElementById('order-summary-list');
        const summaryHeader = document.getElementById('summary-header');
        
        if (sidebar) {
            sidebar.classList.add('visible');
            // Small timeout to allow display:block to render before applying transform transition
            setTimeout(() => sidebar.classList.add('animate-in'), 10);
        }
        if (skeletonLoader) skeletonLoader.style.display = 'flex';
        if (summaryList) {
            summaryList.innerHTML = '';
            summaryList.classList.remove('visible');
        }
        if (summaryHeader) {
            summaryHeader.classList.add('hidden');
        }

        try {
            if (validFiles.length === 1) {
                currentInputBuffer = await validFiles[0].arrayBuffer();
            } else {
                // Merge multiple PDFs into currentInputBuffer
                const { PDFDocument } = PDFLib;
                const mergedPdf = await PDFDocument.create();
                for (const f of validFiles) {
                    const buf = await f.arrayBuffer();
                    const pdf = await PDFDocument.load(buf);
                    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                    copiedPages.forEach((page) => mergedPdf.addPage(page));
                }
                const mergedBytes = await mergedPdf.save();
                currentInputBuffer = mergedBytes.buffer;
            }
            
            // Populate File Queue with fade-in animations
            const queueList = document.getElementById('file-queue-list');
            const queueSection = document.getElementById('uploaded-files-queue');
            if (queueList && queueSection) {
                queueSection.style.display = 'block';
                queueList.innerHTML = '';
                
                validFiles.forEach((f, idx) => {
                    const sizeKb = Math.round(f.size / 1024);
                    const sizeStr = sizeKb > 1024 ? (sizeKb / 1024).toFixed(1) + ' MB' : sizeKb + ' KB';
                    
                    const item = document.createElement('div');
                    item.className = 'file-queue-item';
                    item.style.opacity = '0';
                    item.style.transform = 'translateY(12px)';
                    item.style.transition = `opacity 300ms ease ${idx * 120}ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 120}ms`;
                    item.style.background = 'var(--bg-page)';
                    item.style.padding = '10px 12px';
                    item.style.borderRadius = '8px';
                    item.style.border = '1px solid var(--border-color)';
                    item.style.display = 'flex';
                    item.style.alignItems = 'center';
                    item.style.justifyContent = 'space-between';
                    item.style.gap = '12px';
                    
                    item.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
                            <div style="width: 36px; height: 36px; border-radius: 6px; background: rgba(239, 68, 68, 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </div>
                            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-main); overflow: hidden; text-overflow: ellipsis;">${f.name}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">${sizeStr} • PDF Document</div>
                            </div>
                        </div>
                        <span style="color: var(--accent-success); font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Ready
                        </span>
                    `;
                    
                    queueList.appendChild(item);
                    
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            item.style.opacity = '1';
                            item.style.transform = 'translateY(0)';
                        });
                    });
                });
            }
            
            // Show Upload Modal instead of immediately processing
            const uploadModal = document.getElementById('upload-modal');
            const uploadOverlay = document.getElementById('upload-modal-overlay');
            if (uploadModal && uploadOverlay) {
                uploadModal.classList.remove('hidden');
                uploadOverlay.classList.remove('hidden');
            } else {
                // Fallback if modal not present
                await executeProcessing();
            }
        } catch (error) {
            console.error(error);
            showToast("An error occurred while processing the PDF. Please try again.", "error");
            statusSection.classList.add('hidden');
            dropZone.classList.remove('hidden');
        }
    }
    
    // --- UI Interactions for Modal ---
    const platformOptions = document.querySelectorAll('.platform-option');
    platformOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            platformOptions.forEach(opt => opt.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
            const radio = e.currentTarget.querySelector('input');
            if (radio) {
                radio.checked = true;
                const headerTitle = document.getElementById('app-main-title');
                if (headerTitle) {
                    let pName = "Multi-Platform";
                    if (radio.value === 'flipkart') pName = "Flipkart";
                    if (radio.value === 'amazon') pName = "Amazon";
                    if (radio.value === 'meesho') pName = "Meesho";
                    headerTitle.innerText = `${pName} Label Cropper`;
                }
            }
            
            // Auto select Courier-wise for Meesho and show Meesho options
            const meeshoOptions = document.getElementById('meesho-options');
            if (radio && radio.value === 'meesho') {
                document.getElementById('sort-method').value = 'courier';
                if (meeshoOptions) meeshoOptions.style.display = 'block';
            } else {
                document.getElementById('sort-method').value = 'sku';
                if (meeshoOptions) meeshoOptions.style.display = 'none';
            }
        });
    });

    const startProcessingBtn = document.getElementById('start-processing-btn');
    if (startProcessingBtn) {
        startProcessingBtn.addEventListener('click', async () => {
            const uploadModal = document.getElementById('upload-modal');
            const uploadOverlay = document.getElementById('upload-modal-overlay');
            uploadModal.classList.add('hidden');
            uploadOverlay.classList.add('hidden');
            
            await executeProcessing();
        });
    }

    async function executeProcessing() {
        try {
            const selectedPlatform = document.querySelector('input[name="platform"]:checked')?.value || 'flipkart';
            const selectedSorting = document.getElementById('sort-method')?.value || 'sku';
            
            await processPDF(currentInputBuffer, selectedPlatform, selectedSorting);
            
            statusSection.classList.add('hidden');
            resultSection.classList.remove('hidden');
            previewSection.classList.remove('hidden');
            
            // Trigger checkmark reflow and reveal buttons after checkmark animation completes
            const checkContainer = document.getElementById('success-checkmark-container');
            if (checkContainer) {
                const svg = checkContainer.innerHTML;
                checkContainer.innerHTML = '';
                void checkContainer.offsetWidth;
                checkContainer.innerHTML = svg;
            }
            const actionBtns = document.getElementById('result-action-buttons');
            if (actionBtns) {
                actionBtns.style.opacity = '0';
                actionBtns.style.transform = 'translateY(12px)';
                actionBtns.style.pointerEvents = 'none';
                setTimeout(() => {
                    actionBtns.style.opacity = '1';
                    actionBtns.style.transform = 'translateY(0)';
                    actionBtns.style.pointerEvents = 'auto';
                }, 750);
            }
        } catch (error) {
            console.error(error);
            showToast("An error occurred while processing the PDF. Please try again.", "error");
            statusSection.classList.add('hidden');
            document.getElementById('drop-zone').classList.remove('hidden');
        }
    }

    async function processPDF(inputBuffer, platform = 'flipkart', sortingMethod = 'sku') {
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        
        const originalPdf = await PDFDocument.load(inputBuffer);
        const originalPages = originalPdf.getPages();
        
        // 1. PDF.js text extraction to determine groupings
        const productCounts = {};
        const pagesByGroup = {};
        
        try {
            const pdfjsLib = window['pdfjs-dist/build/pdf'];
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
            
            const loadingTask = pdfjsLib.getDocument({data: new Uint8Array(inputBuffer)});
            const pdfJsDoc = await loadingTask.promise;
            updateProgress(5, "Analyzing document pages...", `Found ${pdfJsDoc.numPages} pages to process.`);
            
            let pendingAmazonLabelIndex = -1;
            
            for (let i = 1; i <= pdfJsDoc.numPages; i++) {
                updateProgress(5 + (i / pdfJsDoc.numPages) * 45, "Extracting SKU & order text...", `Reading page ${i} of ${pdfJsDoc.numPages}`);
                const page = await pdfJsDoc.getPage(i);
                const textContent = await page.getTextContent();
                let fullText = textContent.items.map(item => item.str).join(' ');
                
                let productName = "Unknown Product";
                let qty = 1;
                let pageIndexToPush = i - 1;
                
                if (platform === 'meesho') {
                    // Extract from Description column first (more accurate/detailed)
                    let descMatch = fullText.match(/Taxes\s+Total\s+([\s\S]+?)\s+\d{4,8}\s+(\d+)\s+Rs\./i);
                    if (descMatch) {
                        productName = descMatch[1].trim();
                        qty = parseInt(descMatch[2], 10);
                    } else {
                        // Fallback to SKU column if Description fails
                        let meeshoMatch = fullText.match(/Order\s+No\.?\s*([\s\S]+?)\s+([A-Za-z0-9.\-]+)\s+(\d+)\s+[A-Za-z0-9.\-]+\s+\d{10,}/i);
                        if (meeshoMatch) {
                            productName = meeshoMatch[1].trim();
                            qty = parseInt(meeshoMatch[3], 10);
                        } else {
                            let fallbackMatch = fullText.match(/Order\s+No\.?\s*(\S+)/i);
                            if (fallbackMatch) productName = fallbackMatch[1].trim();
                        }
                    }
                } else if (platform === 'amazon') {
                    if (!fullText.includes('Tax Invoice') && !fullText.includes('Bill of Supply') && !fullText.includes('Authorized Signatory')) {
                        // This is a Label page
                        pendingAmazonLabelIndex = i - 1;
                        
                        if (i === pdfJsDoc.numPages) {
                            // Edge case: Last page is a label (no invoice following it)
                            let skuMatch = fullText.match(/\d{2}-\d{2}-\d{4}\s+([A-Za-z0-9_\-\.\s]+?)\s*(?:STVT|MSTA|MIXD|VNSF|ATSPL|Sold on:|\b[A-Z]{4}\b)/i);
                            if (skuMatch && skuMatch[1]) productName = skuMatch[1].trim();
                            else productName = "Amazon Order";
                        } else {
                            continue; // Wait for the invoice page to extract full name & qty
                        }
                    } else {
                        // This is an Invoice page!
                        let itemRegex = /(?:^|\s)(1|2|3|4|5|6|7|8|9|10)\s+([A-Za-z0-9\s\,\-\&\|\(\)\+]+?)(?:\s+HSN:|\s+B0[A-Z0-9]{8})/g;
                        let match;
                        let items = [];
                        while ((match = itemRegex.exec(fullText)) !== null) {
                            let name = match[2].trim();
                            name = name.split('|')[0].trim();
                            if (name.length > 40) name = name.substring(0, 40).trim();
                            items.push(name);
                        }
                        
                        let fallbackName = "Amazon Order";
                        if (items.length === 0) {
                            let nameMatch = fullText.match(/Total Amount\s+1\s+([\s\S]+?)(?:\s+HSN:|\s+\||\s+B0)/i);
                            if (!nameMatch) nameMatch = fullText.match(/1\s+([A-Za-z0-9\s\,\-\&\|]+?)(?:\s+HSN:|\s+B0)/i);
                            if (nameMatch && nameMatch[1]) {
                                fallbackName = nameMatch[1].trim().substring(0, 40).trim();
                            }
                            items.push(fallbackName);
                        }
                        
                        // Register EACH item in productCounts for the summary table
                        for (let idx = 0; idx < items.length; idx++) {
                            let itemName = items[idx];
                            if (!productCounts[itemName]) productCounts[itemName] = { totalItems: 0, labels: 0, qtyBreakdown: {} };
                            productCounts[itemName].totalItems += 1; // Assume qty 1 per unique item in combo for now
                            if (idx === 0) productCounts[itemName].labels += 1;
                            
                            if (!productCounts[itemName].qtyBreakdown[1]) productCounts[itemName].qtyBreakdown[1] = 0;
                            productCounts[itemName].qtyBreakdown[1] += 1;
                        }
                        
                        // Grouping for the PDF Label
                        let groupKey = items.length > 1 ? "COMBO: " + items.join(' + ') : items[0];
                        if (groupKey.length > 50) groupKey = groupKey.substring(0, 50) + "...";
                        
                        if (!pagesByGroup[groupKey]) pagesByGroup[groupKey] = [];
                        if (pendingAmazonLabelIndex !== -1) {
                            pagesByGroup[groupKey].push(pendingAmazonLabelIndex);
                            pendingAmazonLabelIndex = -1;
                        }
                        
                        continue; // Skip the standard bottom-of-loop logic!
                    }
                } else {
                    let match = fullText.match(/Description\s*(?:QTY)?\s*\d*\s*(.*?)(?:\||FMP[A-Z0-9]{8,}|Return|Not for resale|Printed|AWB|\b\d{10,}\b)/i);
                    if (match && match[1]) {
                        productName = match[1].trim();
                        productName = productName.replace(/\s*\d+$/, '').trim();
                    } else {
                        let idx = fullText.indexOf('Description');
                        if (idx !== -1) {
                            productName = fullText.substring(idx + 11).trim().split('|')[0].substring(0, 40).trim();
                            if (productName.length === 40) productName += "...";
                        }
                    }
                    
                    let fullDescMatch = fullText.match(/Description\s*(?:QTY)?\s*\d*\s*(.*?)(?:FMP[A-Z0-9]{8,}|Return|Not for resale|Printed|AWB|\b\d{10,}\b)/i);
                    if (fullDescMatch && fullDescMatch[1]) {
                        let fullDesc = fullDescMatch[1].trim();
                        let endQtyMatch = fullDesc.match(/\s+(\d+)\s*$/);
                        if (endQtyMatch && endQtyMatch[1]) {
                            qty = parseInt(endQtyMatch[1], 10);
                        }
                    }
                }
                
                if (qty <= 0 || qty > 100) qty = 1;
                
                let groupKey = productName;
                if (sortingMethod === 'courier') {
                    const knownCouriers = ['Delhivery', 'Shadowfax', 'Ecom Express', 'Xpressbees', 'Valmo', 'Ekart'];
                    let foundCourier = 'Other Courier';
                    for (const c of knownCouriers) {
                        if (fullText.toLowerCase().includes(c.toLowerCase())) {
                            foundCourier = c;
                            break;
                        }
                    }
                    groupKey = `[${foundCourier}] ${productName}`;
                }
                
                if (productName.length > 0) {
                    if (!productCounts[groupKey]) {
                        productCounts[groupKey] = { totalItems: 0, labels: 0, qtyBreakdown: {} };
                        pagesByGroup[groupKey] = [];
                    }
                    productCounts[groupKey].totalItems += qty;
                    productCounts[groupKey].labels += 1;
                    
                    if (!productCounts[groupKey].qtyBreakdown[qty]) {
                        productCounts[groupKey].qtyBreakdown[qty] = 0;
                    }
                    productCounts[groupKey].qtyBreakdown[qty] += 1;
                    
                    pagesByGroup[groupKey].push(pageIndexToPush); // Store 0-indexed page number
                } else {
                    const unknownKey = "Unknown Product";
                    if (!pagesByGroup[unknownKey]) {
                        pagesByGroup[unknownKey] = [];
                    }
                    pagesByGroup[unknownKey].push(pageIndexToPush);
                }
            }
        } catch (err) {
            console.error("Text extraction failed:", err);
        }
        
        // 2. Create New PDF with Sorted Pages & First-Label SKU Text
        const newPdf = await PDFDocument.create();
        const helveticaFont = await newPdf.embedFont(StandardFonts.HelveticaBold);
        let processedCount = 0;
        
        const sortedKeys = Object.keys(pagesByGroup).sort();
        const totalPagesToCrop = Object.values(pagesByGroup).reduce((acc, val) => acc + val.length, 0);
        updateProgress(50, "Sorting labels...", "Grouping by SKU and sorting orders...");
        
        for (const groupKey of sortedKeys) {
            const pageIndices = pagesByGroup[groupKey];
            let isFirstLabelOfGroup = true;
            
            // Extract actual product name (without courier prefix if it exists)
            let actualProductName = groupKey;
            const match = groupKey.match(/^\[.*?\]\s*(.*)$/);
            if (match && match[1]) {
                actualProductName = match[1];
            }
            
            for (const originalPageIndex of pageIndices) {
                const originalPage = originalPages[originalPageIndex];
                const { width, height } = originalPage.getSize();
                
                let marginX, marginTop, labelHeight, labelWidth, yOffset, extraTopMargin = 0;
                
                if (platform === 'amazon') {
                    marginX = 0; marginTop = 0; labelHeight = height; labelWidth = width; yOffset = 0; extraTopMargin = 0;
                } else if (platform === 'meesho') {
                    // Precise Meesho cropping (cut above Fold Here line)
                    marginX = 8; marginTop = 5; labelHeight = height * 0.405; labelWidth = width - (marginX * 2); yOffset = -(height - marginTop - labelHeight); extraTopMargin = 15;
                } else {
                    // Default: Flipkart
                    marginX = 185; marginTop = 20; labelHeight = height * 0.43; labelWidth = width - (marginX * 2); yOffset = -(height - marginTop - labelHeight); extraTopMargin = 0;
                }
                
                const [embeddedPage] = await newPdf.embedPdf(originalPdf, [originalPageIndex]);
                const newPage = newPdf.addPage([labelWidth, labelHeight + extraTopMargin]);
                const xOffset = -marginX;
                
                newPage.drawPage(embeddedPage, {
                    x: xOffset,
                    y: yOffset,
                    xScale: 1,
                    yScale: 1,
                });
                
                // Draw SKU Name on top of the labels
                // For Meesho, draw on EVERY label to fill the extra top margin. For others, only the first label.
                const shouldDrawSKU = (platform === 'meesho') || isFirstLabelOfGroup;
                
                if (shouldDrawSKU && actualProductName !== "Unknown Product") {
                    if (extraTopMargin > 0) {
                        // Draw white background to hide any original PDF content bleeding into the top margin
                        newPage.drawRectangle({
                            x: 0,
                            y: labelHeight,
                            width: labelWidth,
                            height: extraTopMargin,
                            color: rgb(1, 1, 1),
                        });
                    }
                    
                    // Small black text placed strictly in the top white margin
                    newPage.drawText(actualProductName, {
                        x: 15,
                        y: labelHeight + (extraTopMargin > 0 ? 4 : -8),
                        size: 8,
                        font: helveticaFont,
                        color: rgb(0, 0, 0),
                    });
                }
                isFirstLabelOfGroup = false;
                
                const includeInvoice = document.getElementById('include-invoice') ? document.getElementById('include-invoice').checked : false;
                if (platform === 'meesho' && includeInvoice) {
                    const invMarginTop = height * 0.435; // Start exactly below Fold Here, right at TAX INVOICE
                    const invMarginBottom = height * 0.28; // Cut off bottom blank white space up to the footer
                    const invLabelHeight = height - invMarginTop - invMarginBottom;
                    const invYOffset = -(height - invMarginTop - invLabelHeight);
                    
                    const invoicePage = newPdf.addPage([labelWidth, invLabelHeight + extraTopMargin]);
                    invoicePage.drawPage(embeddedPage, {
                        x: xOffset,
                        y: invYOffset,
                        xScale: 1,
                        yScale: 1,
                    });

                    // Draw SKU Name on top of the invoice page as well
                    if (actualProductName !== "Unknown Product") {
                        if (extraTopMargin > 0) {
                            // Draw white background to completely hide the 'Fold Here' line bleeding into top margin
                            invoicePage.drawRectangle({
                                x: 0,
                                y: invLabelHeight,
                                width: labelWidth,
                                height: extraTopMargin,
                                color: rgb(1, 1, 1),
                            });
                        }
                        
                        invoicePage.drawText(actualProductName, {
                            x: 15,
                            y: invLabelHeight + (extraTopMargin > 0 ? 4 : -8),
                            size: 8,
                            font: helveticaFont,
                            color: rgb(0, 0, 0),
                        });
                    }
                }
                
                processedCount++;
                updateProgress(50 + (processedCount / Math.max(1, totalPagesToCrop)) * 45, "Cropping shipping labels...", `Processing page ${processedCount} of ${totalPagesToCrop}`);
            }
        }
        
        updateProgress(96, "Finalizing PDF...", "Generating download bundle...");
        processedPdfBytes = await newPdf.save();
        updateProgress(100, "Processing Complete!", "Your cropped labels are ready.");
        
        // Update Preview
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        const blob = new Blob([processedPdfBytes], { type: 'application/pdf' });
        previewUrl = URL.createObjectURL(blob);
        pdfPreview.src = previewUrl;
        
        resultDetails.innerText = `Successfully processed ${processedCount} order(s).`;
        
        // Update global performance metrics
        if (platform === 'amazon') globalPerformance.amazon += processedCount;
        else if (platform === 'flipkart') globalPerformance.flipkart += processedCount;
        else if (platform === 'meesho') globalPerformance.meesho += processedCount;
        
        if (typeof saveGlobalPerformance === 'function') {
            saveGlobalPerformance();
        }
        if (typeof renderHotSellingTable === 'function') {
            renderHotSellingTable();
        }
        
        // Update Order Summary UI
        const summaryContainer = document.getElementById('order-summary-container');
        const summaryList = document.getElementById('order-summary-list');
        const summaryHeader = document.getElementById('summary-header');
        summaryList.innerHTML = '';
        
        let hasProducts = Object.keys(productCounts).length > 0;
        
        if (hasProducts) {
            // Find max quantity to determine how many columns we need
            let maxQty = 1;
            for (const data of Object.values(productCounts)) {
                for (const q of Object.keys(data.qtyBreakdown)) {
                    if (parseInt(q) > maxQty) maxQty = parseInt(q);
                }
            }
            
            // Limit to max 5 columns to avoid UI breaking, usually it's QTY 1, 2, 3
            if (maxQty > 5) maxQty = 5;
            
            // Rebuild Header dynamically
            summaryHeader.innerHTML = `<span class="header-name">SKU Name</span>`;
            for(let i=1; i<=maxQty; i++) {
                summaryHeader.innerHTML += `<span class="header-col">QTY ${i}</span>`;
            }
            summaryHeader.innerHTML += `<span class="header-col">Orders</span>`;
            
            // Update CSS Grid for dynamic columns (Name + QTY cols + TotalOrders)
            const gridTemplate = `2fr ${'1fr '.repeat(maxQty).trim()} 1fr`;
            summaryHeader.style.display = 'grid';
            summaryHeader.style.gridTemplateColumns = gridTemplate;
            summaryHeader.style.gap = '10px';
            summaryHeader.style.textAlign = 'center';
            summaryHeader.querySelector('.header-name').style.textAlign = 'left';
            
            let totalOverallItems = 0;
            let totalOverallLabels = 0;
            let totalQtyBreakdown = {};
            for(let i=1; i<=maxQty; i++) totalQtyBreakdown[i] = 0;

            for (const [product, data] of Object.entries(productCounts)) {
                totalOverallItems += data.totalItems;
                totalOverallLabels += data.labels;
                
                const li = document.createElement('li');
                li.className = 'summary-item';
                li.style.display = 'grid';
                li.style.gridTemplateColumns = gridTemplate;
                li.style.gap = '10px';
                li.style.alignItems = 'center';
                li.style.textAlign = 'center';
                
                const nameSpan = document.createElement('span');
                nameSpan.className = 'name';
                nameSpan.innerText = product;
                nameSpan.style.textAlign = 'left';
                
                const countSpan = document.createElement('span');
                countSpan.className = 'count';
                countSpan.innerText = data.totalItems; // Total items for this SKU
                
                li.appendChild(nameSpan);
                
                for(let i=1; i<=maxQty; i++) {
                    const qtySpan = document.createElement('span');
                    const qtyCount = data.qtyBreakdown[i] || 0;
                    
                    if (qtyCount === 0) {
                        qtySpan.innerText = '-';
                        qtySpan.style.color = 'var(--text-muted)';
                    } else if (qtyCount === 1 && i > 1) {
                        // User requested a tick mark instead of '1' for QTY 2, QTY 3, etc.
                        qtySpan.innerHTML = '✔';
                        qtySpan.style.color = 'var(--accent-success)'; // Green tick
                        qtySpan.style.fontWeight = '700';
                    } else {
                        qtySpan.innerText = qtyCount;
                        qtySpan.style.color = 'var(--text-main)';
                        qtySpan.style.fontWeight = '600';
                    }
                    
                    li.appendChild(qtySpan);
                    totalQtyBreakdown[i] += qtyCount;
                }
                
                // Append the Orders count at the very end
                li.appendChild(countSpan);
                
                summaryList.appendChild(li);
            }
            
            // Add TOTAL Row
            const totalLi = document.createElement('li');
            totalLi.className = 'summary-item summary-total-row';
            totalLi.style.display = 'grid';
            totalLi.style.gridTemplateColumns = gridTemplate;
            totalLi.style.gap = '10px';
            totalLi.style.alignItems = 'center';
            totalLi.style.textAlign = 'center';
            totalLi.style.marginTop = '10px';
            totalLi.style.paddingTop = '12px';
            totalLi.style.borderTop = '2px solid var(--border-strong)';
            totalLi.style.borderBottom = 'none';
            totalLi.style.fontWeight = '700';
            
            const totalLabel = document.createElement('span');
            totalLabel.innerText = 'TOTAL';
            totalLabel.style.textAlign = 'left';
            totalLabel.style.color = 'var(--primary-color)';
            
            const totalOrdersSpan = document.createElement('span');
            totalOrdersSpan.innerText = totalOverallItems;
            totalOrdersSpan.style.color = 'var(--primary-color)';
            
            totalLi.appendChild(totalLabel);
            
            for(let i=1; i<=maxQty; i++) {
                const totalQtySpan = document.createElement('span');
                totalQtySpan.innerText = totalQtyBreakdown[i] > 0 ? totalQtyBreakdown[i] : '-';
                totalQtySpan.style.color = totalQtyBreakdown[i] > 0 ? 'var(--text-main)' : 'var(--text-muted)';
                totalLi.appendChild(totalQtySpan);
            }
            
            // Append total Orders count at the very end
            totalLi.appendChild(totalOrdersSpan);
            
            summaryList.appendChild(totalLi);
        }
        
        // Auto-Deduct from Inventory
        if (hasProducts) {
            updateInventoryFromOrders(productCounts, platform);
        }
        
        const sidebar = document.getElementById('sidebar');
        const skeletonLoader = document.getElementById('skeleton-loader');
        
        if (hasProducts) {
            if (skeletonLoader) skeletonLoader.style.display = 'none';
            if (summaryHeader) summaryHeader.classList.remove('hidden');
            // Smooth fade in for the actual list
            setTimeout(() => summaryList.classList.add('visible'), 50);
        } else {
            if (sidebar) {
                sidebar.classList.remove('animate-in');
                setTimeout(() => sidebar.classList.remove('visible'), 500); // Wait for transition
            }
        }
    }
    
    // Side Panel Toggle Logic
    const menuBtn = document.getElementById('menu-btn');
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const sidePanel = document.getElementById('side-panel');
    const sidePanelOverlay = document.getElementById('side-panel-overlay');

    function updateNavIndicator(animate = true) {
        const indicator = document.getElementById('side-nav-indicator');
        const activeLink = document.querySelector('.side-panel-nav a.active');
        const navContainer = document.querySelector('.side-panel-nav');
        if (!indicator || !activeLink || !navContainer) return;
        
        const navRect = navContainer.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();
        
        const top = linkRect.top - navRect.top + navContainer.scrollTop;
        const height = linkRect.height;
        
        if (!animate || !indicator.style.top) {
            indicator.style.transition = 'none';
            indicator.style.top = `${top}px`;
            indicator.style.height = `${height}px`;
            indicator.style.opacity = '1';
            void indicator.offsetWidth; // force reflow
            indicator.style.transition = ''; // restore CSS transition
        } else {
            indicator.style.top = `${top}px`;
            indicator.style.height = `${height}px`;
            indicator.style.opacity = '1';
        }
    }

    window.updateNavIndicator = updateNavIndicator;
    window.addEventListener('resize', () => updateNavIndicator(false));

    function toggleSidePanel() {
        if (!sidePanel || !sidePanelOverlay) return;
        const isOpen = sidePanel.classList.contains('open');
        if (isOpen) {
            sidePanel.classList.remove('open');
            sidePanelOverlay.classList.remove('visible');
        } else {
            void sidePanel.offsetWidth;
            void sidePanelOverlay.offsetWidth;
            sidePanel.classList.add('open');
            sidePanelOverlay.classList.add('visible');
            setTimeout(() => updateNavIndicator(false), 10);
            setTimeout(() => updateNavIndicator(false), 150);
        }
    }

    function closeSidePanel() {
        if (!sidePanel || !sidePanelOverlay) return;
        if (sidePanel.classList.contains('open')) {
            sidePanel.classList.remove('open');
            sidePanelOverlay.classList.remove('visible');
        }
    }

    if (menuBtn) menuBtn.addEventListener('click', toggleSidePanel);
    if (closeMenuBtn) closeMenuBtn.addEventListener('click', closeSidePanel);
    if (sidePanelOverlay) sidePanelOverlay.addEventListener('click', closeSidePanel);

    // --- Inventory Management Logic ---
    let inventory = {};
    let globalPerformance = { amazon: 0, flipkart: 0, meesho: 0 };
    let currentUserEmail = 'default';

    let inventoryUnsubscribe = null;
    let isDataLoading = true;
    let inventoryResolved = false;
    let performanceResolved = false;

    function animateCountUp(element, target, duration = 800) {
        if (!element) return;
        let startTimestamp = null;
        target = parseInt(target, 10);
        if (isNaN(target)) target = 0;
        
        if (document.hidden || duration <= 0) {
            element.innerText = target;
            return;
        }
        
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeOutProgress = progress * (2 - progress);
            element.innerText = Math.floor(easeOutProgress * target);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                element.innerText = target;
            }
        };
        window.requestAnimationFrame(step);
    }
    let performanceUnsubscribe = null;

    let loadingTimer = null;
    window.loadInventoryForUser = async function(email) {
        isDataLoading = false;
        inventoryResolved = false;
        performanceResolved = false;
        
        if (loadingTimer) clearTimeout(loadingTimer);
        loadingTimer = setTimeout(() => {
            if (!inventoryResolved || !performanceResolved) {
                isDataLoading = true;
                renderHotSellingTable();
                renderInventoryTable();
            }
        }, 300);
        
        currentUserEmail = email;
        let storageKey = 'inventory_' + email;
        let perfKey = 'performance_' + email;
        
        let loadedFromCloud = false;

        function checkDataLoaded() {
            if (inventoryResolved && performanceResolved) {
                if (loadingTimer) clearTimeout(loadingTimer);
                isDataLoading = false;
                renderHotSellingTable();
                renderInventoryTable();
            }
        }

        if (inventoryUnsubscribe) { inventoryUnsubscribe(); inventoryUnsubscribe = null; }
        if (performanceUnsubscribe) { performanceUnsubscribe(); performanceUnsubscribe = null; }

        function getLegacyData(key, legacyKey) {
            let data = JSON.parse(localStorage.getItem(key));
            if (!data || Object.keys(data).length === 0) {
                let legacyData = JSON.parse(localStorage.getItem(legacyKey));
                if (legacyData && Object.keys(legacyData).length > 0) {
                    localStorage.setItem(key, JSON.stringify(legacyData));
                    return legacyData;
                }
            }
            return data;
        }

        if (window.db && email !== 'default') {
            try {
                inventoryUnsubscribe = window.db.collection('users').doc(email).collection('data').doc('inventory')
                    .onSnapshot((invDoc) => {
                        let cloudInv = invDoc.exists ? invDoc.data() : null;
                        
                        if (cloudInv && Object.keys(cloudInv).length > 0) {
                            localStorage.setItem(storageKey, JSON.stringify(cloudInv));
                            processInventoryData(cloudInv);
                            
                            if (!loadedFromCloud) {
                                loadedFromCloud = true;
                                showToast("Live Sync Active: Data loaded securely from cloud.", "success");
                            }
                        } else {
                            let localInv = getLegacyData(storageKey, 'inventory');
                            if (localInv && Object.keys(localInv).length > 0) {
                                window.db.collection('users').doc(email).collection('data').doc('inventory').set(localInv);
                            } else {
                                processInventoryData({});
                            }
                        }
                        inventoryResolved = true;
                        checkDataLoaded();
                    }, (error) => {
                        console.error("Live Sync Error (Inventory):", error);
                        fallbackToLocal();
                    });
                
                performanceUnsubscribe = window.db.collection('users').doc(email).collection('data').doc('performance')
                    .onSnapshot((perfDoc) => {
                        let cloudPerf = perfDoc.exists ? perfDoc.data() : null;
                        
                        if (cloudPerf && (cloudPerf.amazon > 0 || cloudPerf.flipkart > 0 || cloudPerf.meesho > 0)) {
                            globalPerformance = cloudPerf;
                            localStorage.setItem(perfKey, JSON.stringify(globalPerformance));
                        } else {
                            let localPerf = getLegacyData(perfKey, 'performance');
                            if (!localPerf) {
                                localPerf = JSON.parse(localStorage.getItem('globalPerformance')); 
                            }
                            if (localPerf && (localPerf.amazon > 0 || localPerf.flipkart > 0 || localPerf.meesho > 0)) {
                                window.db.collection('users').doc(email).collection('data').doc('performance').set(localPerf);
                            } else {
                                globalPerformance = { amazon: 0, flipkart: 0, meesho: 0 };
                            }
                        }
                        performanceResolved = true;
                        checkDataLoaded();
                    }, (error) => {
                        console.error("Live Sync Error (Performance):", error);
                    });

            } catch (e) {
                console.error("Cloud listener setup failed, using local storage:", e);
                fallbackToLocal();
            }
        } else {
            fallbackToLocal();
        }

        function fallbackToLocal() {
            if (loadingTimer) clearTimeout(loadingTimer);
            let rawInventory = JSON.parse(localStorage.getItem(storageKey));
            let rawPerf = JSON.parse(localStorage.getItem(perfKey));
            
            if (rawPerf) {
                globalPerformance = rawPerf;
            } else {
                globalPerformance = { amazon: 0, flipkart: 0, meesho: 0 };
            }
            
            processInventoryData(rawInventory || {});
            
            isDataLoading = false;
            inventoryResolved = true;
            performanceResolved = true;
            renderHotSellingTable();
            renderInventoryTable();
        }
        
        function processInventoryData(rawInventory) {
            inventory = {};
            // Migration logic: ensure dispatched is an object, not a number
            for (let sku in rawInventory) {
                let data = rawInventory[sku];
                if (typeof data.dispatched === 'number') {
                    inventory[sku] = {
                        initial: data.initial,
                        dispatched: {
                            total: data.dispatched,
                            amazon: 0,
                            flipkart: data.dispatched,
                            meesho: 0
                        }
                    };
                } else {
                    inventory[sku] = data;
                }
            }
            renderInventoryTable();
            if (typeof window.checkForPendingTransfers === 'function') {
                window.checkForPendingTransfers();
            }
        }
    }
    const inventoryDashboard = document.getElementById('inventory-dashboard');
    const appContent = document.getElementById('app-content');
    const invSkuNameInput = document.getElementById('inv-sku-name');
    const invSkuQtyInput = document.getElementById('inv-sku-qty');
    const addInvBtn = document.getElementById('add-inv-btn');
    const inventoryTableBody = document.getElementById('inventory-table-body');
    const emptyInvMsg = document.getElementById('empty-inv-msg');
    
    // Dashboard inventory table
    const dashboardInventoryTableBody = document.getElementById('dashboard-inventory-table-body');
    const emptyDashboardInvMsg = document.getElementById('empty-dashboard-inv-msg');

    // Helper: get today's date as YYYY-MM-DD in local timezone (not UTC)
    function getTodayISO() {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    // Set date picker to today by default
    const invSkuDateInput = document.getElementById('inv-sku-date');
    if (invSkuDateInput && !invSkuDateInput.value) {
        invSkuDateInput.value = getTodayISO();
    }

    async function saveInventory() {
        let storageKey = 'inventory_' + currentUserEmail;
        localStorage.setItem(storageKey, JSON.stringify(inventory));
        
        if (window.db && currentUserEmail !== 'default') {
            try {
                await window.db.collection('users').doc(currentUserEmail).collection('data').doc('inventory').set(inventory);
            } catch (e) { console.error("Cloud Sync Failed:", e); }
        }
    }
    
    async function saveGlobalPerformance() {
        let perfKey = 'performance_' + currentUserEmail;
        localStorage.setItem(perfKey, JSON.stringify(globalPerformance));
        
        if (window.db && currentUserEmail !== 'default') {
            try {
                await window.db.collection('users').doc(currentUserEmail).collection('data').doc('performance').set(globalPerformance);
            } catch (e) { console.error("Cloud Sync Failed:", e); }
        }
    }

    function renderInventoryTable() {
        if (inventoryTableBody) inventoryTableBody.innerHTML = '';
        if (dashboardInventoryTableBody) dashboardInventoryTableBody.innerHTML = '';
        
        if (isDataLoading) {
            if (emptyInvMsg) emptyInvMsg.style.display = 'none';
            if (emptyDashboardInvMsg) emptyDashboardInvMsg.style.display = 'none';
            
            const invSkeletonRow = `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 14px 12px;"><div class="skeleton-loader" style="height: 18px; width: 65%; border-radius: 4px;"></div></td>
                    <td style="padding: 14px 12px; text-align: center;"><div class="skeleton-loader" style="height: 18px; width: 36px; border-radius: 4px; margin: 0 auto;"></div></td>
                    <td style="padding: 14px 12px; text-align: center;"><div class="skeleton-loader" style="height: 18px; width: 36px; border-radius: 4px; margin: 0 auto;"></div></td>
                    <td style="padding: 14px 12px; text-align: center;"><div class="skeleton-loader" style="height: 18px; width: 36px; border-radius: 4px; margin: 0 auto;"></div></td>
                    <td style="padding: 14px 12px; text-align: center;"><div class="skeleton-loader" style="height: 18px; width: 20px; border-radius: 4px; margin: 0 auto;"></div></td>
                </tr>
            `;
            const dashSkeletonRow = `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px;"><div class="skeleton-loader" style="height: 16px; width: 70%; border-radius: 4px;"></div></td>
                    <td style="padding: 12px; text-align: right;"><div class="skeleton-loader" style="height: 16px; width: 30px; border-radius: 4px; margin: 0 0 0 auto;"></div></td>
                </tr>
            `;
            
            if (inventoryTableBody) inventoryTableBody.innerHTML = invSkeletonRow.repeat(5);
            if (dashboardInventoryTableBody) dashboardInventoryTableBody.innerHTML = dashSkeletonRow.repeat(4);
            return;
        }

        const skus = Object.keys(inventory);
        if (skus.length === 0) {
            if (emptyInvMsg) emptyInvMsg.style.display = 'block';
            if (emptyDashboardInvMsg) emptyDashboardInvMsg.style.display = 'block';
            return;
        }
        if (emptyInvMsg) emptyInvMsg.style.display = 'none';
        if (emptyDashboardInvMsg) emptyDashboardInvMsg.style.display = 'none';

        skus.forEach(sku => {
            const data = inventory[sku];
            const remaining = data.initial - data.dispatched.total;
            
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';
            
            // Highlight low stock (less than 10% or exactly 0)
            let remainingColor = 'var(--primary-color)'; // Default to primary color (indigo)
            let remainingWeight = '700';
            if (remaining <= 0) {
                remainingColor = 'var(--accent-danger)'; // Red
                remainingWeight = '700';
            } else if (remaining < data.initial * 0.2) {
                remainingColor = 'var(--accent-warning)'; // Orange
                remainingWeight = '600';
            }

            tr.innerHTML = `
                <td data-label="SKU Name" style="padding: 12px; font-weight: 500;"><span style="color: var(--primary-color); cursor: pointer; text-decoration: underline;" onclick="showSkuHistory('${sku.replace(/'/g, "\\'")}')">${sku}</span></td>
                <td data-label="Initial Stock" class="animate-number-inv" data-val="${data.initial}" style="padding: 12px; text-align: center;">${data.initial}</td>
                <td data-label="Dispatched" class="animate-number-inv" data-val="${data.dispatched.total}" style="padding: 12px; text-align: center; color: var(--accent-success); font-weight: 600;">${data.dispatched.total}</td>
                <td data-label="Remaining" class="animate-number-inv" data-val="${remaining}" style="padding: 12px; text-align: center; color: ${remainingColor}; font-weight: ${remainingWeight};">${remaining}</td>
                <td data-label="Actions" style="padding: 12px; text-align: center;">
                    <button class="delete-sku-btn" data-sku="${sku}" style="background: transparent; border: none; color: var(--accent-danger); cursor: pointer; padding: 5px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            `;
            if (inventoryTableBody) inventoryTableBody.appendChild(tr);

            // Row for Dashboard (Compact)
            const dTr = document.createElement('tr');
            dTr.style.borderBottom = '1px solid var(--border-color)';
            dTr.innerHTML = `
                <td style="padding: 12px; font-weight: 500; font-size: 0.9rem;"><span style="color: var(--primary-color); cursor: pointer; text-decoration: underline;" onclick="showSkuHistory('${sku.replace(/'/g, "\\'")}')">${sku}</span></td>
                <td style="padding: 12px; text-align: right; color: ${remainingColor}; font-weight: ${remainingWeight};">${remaining}</td>
            `;
            if (dashboardInventoryTableBody) dashboardInventoryTableBody.appendChild(dTr);
        });

        document.querySelectorAll('.animate-number-inv').forEach(el => {
            animateCountUp(el, el.getAttribute('data-val'));
            el.classList.remove('animate-number-inv');
        });

        // Add delete listeners
        document.querySelectorAll('.delete-sku-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const skuToDelete = e.currentTarget.getAttribute('data-sku');
                showConfirm(
                    "Delete SKU",
                    `Are you sure you want to delete ${skuToDelete} from inventory?`,
                    () => {
                        delete inventory[skuToDelete];
                        saveInventory();
                        renderInventoryTable();
                        showToast(`Deleted ${skuToDelete} from inventory.`, "success");
                    },
                    "Delete",
                    "var(--accent-danger)"
                );
            });
        });
    }

    if (addInvBtn) {
        addInvBtn.addEventListener('click', async () => {
            const skuName = invSkuNameInput.value.trim();
            const skuQtyVal = invSkuQtyInput.value.trim();
            const skuQty = parseInt(skuQtyVal);
            const dateInput = document.getElementById('inv-sku-date');
            const skuDate = dateInput ? dateInput.value : '';
            const errorDiv = document.getElementById('inv-sku-error');
            
            // Helper to trigger shake animation on field
            const shakeField = (field) => {
                if (!field) return;
                field.classList.remove('shake-animation');
                void field.offsetWidth;
                field.classList.add('shake-animation');
                setTimeout(() => field.classList.remove('shake-animation'), 500);
            };

            // Validation checks
            let errMsg = '';
            if (!skuName && !skuQtyVal) {
                errMsg = 'Please enter both SKU Name and Initial Inventory.';
                shakeField(invSkuNameInput);
                shakeField(invSkuQtyInput);
            } else if (!skuName) {
                errMsg = 'SKU Name cannot be empty.';
                shakeField(invSkuNameInput);
            } else if (!skuQtyVal || isNaN(skuQty) || skuQty < 0) {
                errMsg = 'Please enter a valid inventory quantity (0 or greater).';
                shakeField(invSkuQtyInput);
            }

            if (errMsg) {
                if (errorDiv) {
                    errorDiv.innerHTML = `⚠️ <span>${errMsg}</span>`;
                    errorDiv.classList.remove('hidden');
                    errorDiv.classList.remove('fade-in-error');
                    void errorDiv.offsetWidth;
                    errorDiv.classList.add('fade-in-error');
                }
                return;
            }

            if (errorDiv) {
                errorDiv.classList.add('hidden');
            }

            // 1. Show loading spinner on button and disable it
            const originalBtnText = addInvBtn.innerHTML;
            addInvBtn.disabled = true;
            addInvBtn.style.opacity = '0.75';
            addInvBtn.style.cursor = 'not-allowed';
            addInvBtn.innerHTML = `<span style="display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 8px; vertical-align: -2px;"></span>Adding...`;

            // Simulate slight async request duration for smooth spinner feedback
            await new Promise(resolve => setTimeout(resolve, 500));

            const resolvedDate = skuDate || new Date().toISOString().split('T')[0];

            // If exists, just update initial stock
            if (inventory[skuName]) {
                inventory[skuName].initial += skuQty;
                if (skuDate) inventory[skuName].dateAdded = skuDate;
                if (!inventory[skuName].history) inventory[skuName].history = [];
                inventory[skuName].history.push({
                    date: resolvedDate,
                    type: 'ADD',
                    quantity: skuQty,
                    platform: 'Manual'
                });
            } else {
                inventory[skuName] = {
                    initial: skuQty,
                    dateAdded: skuDate,
                    history: [{
                        date: resolvedDate,
                        type: 'ADD',
                        quantity: skuQty,
                        platform: 'Manual'
                    }],
                    dispatched: {
                        total: 0,
                        amazon: 0,
                        flipkart: 0,
                        meesho: 0
                    }
                };
            }
            
            saveInventory();
            renderInventoryTable();
            
            // Restore button
            addInvBtn.disabled = false;
            addInvBtn.style.opacity = '1';
            addInvBtn.style.cursor = 'pointer';
            addInvBtn.innerHTML = originalBtnText;

            // 2. Show toast notification auto-dismissing after ~3s
            showToast("SKU added successfully ✓", "success", 3000);
            
            // Clear inputs
            invSkuNameInput.value = '';
            invSkuQtyInput.value = '';
            if (dateInput) dateInput.value = getTodayISO();
        });
    }

    const skuSearchInput = document.getElementById('sku-search-input');
    if (skuSearchInput) {
        skuSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#inventory-table-body tr');
            rows.forEach(row => {
                if (row.cells && row.cells.length > 0) {
                    const skuName = row.cells[0].innerText.toLowerCase();
                    row.style.display = skuName.includes(searchTerm) ? '' : 'none';
                }
            });
        });
    }

    // Modal Logic
    window.showSkuHistory = function(skuName) {
        const modal = document.getElementById('sku-history-modal');
        const overlay = document.getElementById('sku-history-modal-overlay');
        const title = document.getElementById('history-modal-title');
        const tbody = document.getElementById('sku-history-table-body');
        const emptyMsg = document.getElementById('empty-history-msg');
        
        if (!modal || !overlay) return;
        
        title.innerText = `History: ${skuName}`;
        tbody.innerHTML = '';
        
        const skuData = inventory[skuName];
        if (!skuData) return;
        
        const history = skuData.history || [];
        
        if (history.length === 0) {
            // Generate baseline history if none exists
            history.push({
                date: skuData.dateAdded || 'N/A',
                type: 'ADD',
                quantity: skuData.initial,
                platform: 'Baseline'
            });
        }
        
        emptyMsg.style.display = 'none';
        
        // Sort history by date descending
        const sortedHistory = [...history].sort((a, b) => {
            if(a.date === 'N/A') return 1;
            if(b.date === 'N/A') return -1;
            return new Date(b.date) - new Date(a.date);
        });

        sortedHistory.forEach(entry => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';
            const typeColor = entry.type === 'ADD' ? 'var(--accent-success)' : 'var(--accent-danger)';
            tr.innerHTML = `
                <td style="padding: 10px;">${entry.date}</td>
                <td style="padding: 10px; color: ${typeColor}; font-weight: 600;">${entry.type === 'ADD' ? 'Stock In' : 'Stock Out'}</td>
                <td style="padding: 10px;">${entry.quantity}</td>
                <td style="padding: 10px;">${entry.platform || 'N/A'}</td>
            `;
            tbody.appendChild(tr);
        });
        
        modal.classList.remove('hidden');
        overlay.classList.remove('hidden');
        
        // slight delay for animation
        setTimeout(() => {
            modal.classList.add('visible');
            overlay.classList.add('visible');
        }, 10);
    };
    
    window.closeSkuHistory = function() {
        const modal = document.getElementById('sku-history-modal');
        const overlay = document.getElementById('sku-history-modal-overlay');
        if (!modal || !overlay) return;
        
        modal.classList.remove('visible');
        overlay.classList.remove('visible');
        
        setTimeout(() => {
            modal.classList.add('hidden');
            overlay.classList.add('hidden');
        }, 300); // match transition duration
    };

    function updateInventoryFromOrders(productCounts, platform) {
        let inventoryUpdated = false;
        
        const sidebarInvUpdate = document.getElementById('sidebar-inventory-update');
        const sidebarInvList = document.getElementById('sidebar-inventory-list');
        
        if (sidebarInvList) sidebarInvList.innerHTML = '';
        
        for (const [groupKey, data] of Object.entries(productCounts)) {
            // Because groupKey might have Courier prefix e.g. "[Delhivery] Electric Mini Chopper"
            // We need to extract the actual product name to check against inventory
            let actualProductName = groupKey;
            const match = groupKey.match(/^\[.*?\]\s*(.*)$/);
            if (match && match[1]) {
                actualProductName = match[1];
            }
            
            if (inventory[actualProductName]) {
                inventory[actualProductName].dispatched.total += data.totalItems;
                if (platform === 'amazon') inventory[actualProductName].dispatched.amazon += data.totalItems;
                else if (platform === 'meesho') inventory[actualProductName].dispatched.meesho += data.totalItems;
                else inventory[actualProductName].dispatched.flipkart += data.totalItems;
                
                if (!inventory[actualProductName].history) inventory[actualProductName].history = [];
                inventory[actualProductName].history.push({
                    date: new Date().toISOString().split('T')[0],
                    type: 'DISPATCH',
                    quantity: data.totalItems,
                    platform: platform.charAt(0).toUpperCase() + platform.slice(1)
                });

                inventoryUpdated = true;
                
                // Add to sidebar inventory list
                if (sidebarInvList) {
                    const remaining = inventory[actualProductName].initial - inventory[actualProductName].dispatched.total;
                    const li = document.createElement('li');
                    li.className = 'summary-item';
                    let remainingColor = 'var(--primary-color)'; // Default to primary color (indigo)
                    let remainingWeight = '700';
                    if (remaining <= 0) {
                        remainingColor = 'var(--accent-danger)';
                        remainingWeight = '700';
                    } else if (remaining < inventory[actualProductName].initial * 0.2) {
                        remainingColor = 'var(--accent-warning)';
                        remainingWeight = '600';
                    }
                    
                    li.innerHTML = `
                        <span class="item-name">${actualProductName}</span>
                        <span class="item-count" style="color: ${remainingColor}; font-weight: ${remainingWeight}; width: auto; min-width: 40px; text-align: right;">${remaining}</span>
                    `;
                    sidebarInvList.appendChild(li);
                }
            }
        }
        
        if (inventoryUpdated) {
            saveInventory();
            renderInventoryTable();
            renderHotSellingTable();
            
            if (sidebarInvUpdate) {
                sidebarInvUpdate.classList.remove('hidden');
                if (sidebarInvList) sidebarInvList.classList.add('visible');
            }
        } else {
            if (sidebarInvUpdate) {
                sidebarInvUpdate.classList.add('hidden');
                if (sidebarInvList) sidebarInvList.classList.remove('visible');
            }
        }
    }
    
    // --- Analytics & Hot Selling Logic ---
    const hotSellingTableBody = document.getElementById('hot-selling-table-body');
    const emptyHotSellingMsg = document.getElementById('empty-hot-selling-msg');
    let platformSalesChartInstance = null;

    function renderHotSellingTable() {
        if (!hotSellingTableBody) return;
        
        const amzEl = document.getElementById('amazon-total-metric');
        const fkEl = document.getElementById('flipkart-total-metric');
        const msEl = document.getElementById('meesho-total-metric');

        if (isDataLoading) {
            if (emptyHotSellingMsg) emptyHotSellingMsg.style.display = 'none';
            if (amzEl) amzEl.innerHTML = '<div class="skeleton-loader" style="height: 24px; width: 40px; margin: 0 auto; border-radius: 4px;"></div>';
            if (fkEl) fkEl.innerHTML = '<div class="skeleton-loader" style="height: 24px; width: 40px; margin: 0 auto; border-radius: 4px;"></div>';
            if (msEl) msEl.innerHTML = '<div class="skeleton-loader" style="height: 24px; width: 40px; margin: 0 auto; border-radius: 4px;"></div>';
            
            const hotSkeletonRow = `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px; text-align: center;"><div class="skeleton-loader" style="height: 16px; width: 16px; border-radius: 4px; margin: 0 auto;"></div></td>
                    <td style="padding: 12px;"><div class="skeleton-loader" style="height: 16px; width: 60%; border-radius: 4px;"></div></td>
                    <td style="padding: 12px; text-align: center;"><div class="skeleton-loader" style="height: 16px; width: 30px; border-radius: 4px; margin: 0 auto;"></div></td>
                    <td style="padding: 12px; text-align: center;"><div class="skeleton-loader" style="height: 16px; width: 30px; border-radius: 4px; margin: 0 auto;"></div></td>
                    <td style="padding: 12px; text-align: center;"><div class="skeleton-loader" style="height: 16px; width: 30px; border-radius: 4px; margin: 0 auto;"></div></td>
                    <td style="padding: 12px; text-align: center;"><div class="skeleton-loader" style="height: 16px; width: 30px; border-radius: 4px; margin: 0 auto;"></div></td>
                </tr>
            `;
            hotSellingTableBody.innerHTML = hotSkeletonRow.repeat(5);
            return;
        }

        // Calculate and update top metrics using globalPerformance
        let totalAmazon = globalPerformance.amazon || 0;
        let totalFlipkart = globalPerformance.flipkart || 0;
        let totalMeesho = globalPerformance.meesho || 0;
        
        if (amzEl) animateCountUp(amzEl, totalAmazon);
        if (fkEl) animateCountUp(fkEl, totalFlipkart);
        if (msEl) animateCountUp(msEl, totalMeesho);

        // Convert inventory object to array and sort by dispatched.total descending
        const sortedSkus = Object.entries(inventory)
            .filter(([sku, data]) => data.dispatched.total > 0)
            .sort((a, b) => b[1].dispatched.total - a[1].dispatched.total);
            
        if (sortedSkus.length === 0) {
            hotSellingTableBody.innerHTML = '';
            emptyHotSellingMsg.style.display = 'block';
            return;
        }
        
        emptyHotSellingMsg.style.display = 'none';
        hotSellingTableBody.innerHTML = '';
        
        sortedSkus.forEach(([sku, data], index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="#" style="text-align: center; font-weight: 600;">
                    ${index + 1}
                </td>
                <td data-label="SKU Name" style="font-weight: 500; word-break: break-word;">
                    ${sku}
                </td>
                <td data-label="Orders" class="animate-number" data-val="${data.dispatched.total}" style="text-align: center; font-weight: 700; color: var(--primary-color);">0</td>
                <td data-label="Amazon" class="animate-number" data-val="${data.dispatched.amazon}" style="text-align: center; color: ${data.dispatched.amazon > 0 ? 'var(--brand-amazon)' : 'var(--text-muted)'}; font-weight: ${data.dispatched.amazon > 0 ? '600' : 'normal'};">0</td>
                <td data-label="Flipkart" class="animate-number" data-val="${data.dispatched.flipkart}" style="text-align: center; color: ${data.dispatched.flipkart > 0 ? 'var(--brand-flipkart)' : 'var(--text-muted)'}; font-weight: ${data.dispatched.flipkart > 0 ? '600' : 'normal'};">0</td>
                <td data-label="Meesho" class="animate-number" data-val="${data.dispatched.meesho}" style="text-align: center; color: ${data.dispatched.meesho > 0 ? 'var(--brand-meesho)' : 'var(--text-muted)'}; font-weight: ${data.dispatched.meesho > 0 ? '600' : 'normal'};">0</td>
            `;
            hotSellingTableBody.appendChild(tr);
        });

        document.querySelectorAll('.animate-number').forEach(el => {
            animateCountUp(el, el.getAttribute('data-val'));
            el.classList.remove('animate-number');
        });
    }


    // --- Navigation Links ---
    const sideLinks = document.querySelectorAll('.side-panel-nav a');
    
    sideLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (e.currentTarget.getAttribute('target') === '_blank') {
                return; // Let browser handle external/blank links
            }
            e.preventDefault();
            const text = e.currentTarget.innerText.trim();
            
            // Security: Prevent navigation if auth container is visible (user not logged in)
            const authContainer = document.getElementById('auth-container');
            if (authContainer && authContainer.style.display !== 'none' && !authContainer.classList.contains('hidden')) {
                return; // User is on login screen
            }
            
            sideLinks.forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
            if (typeof window.updateNavIndicator === 'function') window.updateNavIndicator(true);
            // Get all possible dashboards
            const dashboards = document.querySelectorAll('.app-wrapper');
            
            // Hide everything first
            dashboards.forEach(d => { if(d) d.classList.add('hidden') });
            
            if (text === 'Dashboard') {
                const d = document.getElementById('analytics-dashboard');
                if (d) d.classList.remove('hidden');
            } else if (text === 'Add SKU') {
                const d = document.getElementById('add-sku-dashboard');
                if (d) d.classList.remove('hidden');
            } else if (text === 'Live Inventory') {
                const d = document.getElementById('live-inventory-dashboard');
                if (d) d.classList.remove('hidden');
            } else if (text === 'Settings') {
                const d = document.getElementById('settings-dashboard');
                if (d) d.classList.remove('hidden');
            } else if (text === 'Label Cropper') {
                const d = document.getElementById('app-content');
                if (d) d.classList.remove('hidden');
                
                // Update the title generic
                const headerTitle = appContent.querySelector('.header h1');
                if (headerTitle) {
                    const selectedPlatform = document.querySelector('input[name="platform"]:checked');
                    let pName = "Multi-Platform";
                    if(selectedPlatform) {
                        if (selectedPlatform.value === 'flipkart') pName = "Flipkart";
                        if (selectedPlatform.value === 'amazon') pName = "Amazon";
                        if (selectedPlatform.value === 'meesho') pName = "Meesho";
                    }
                    headerTitle.innerText = `${pName} Label Cropper`;
                }
            } else if (text === 'Privacy Policy') {
                const d = document.getElementById('privacy-dashboard');
                if (d) d.classList.remove('hidden');
            } else if (text === 'Terms & Conditions') {
                const d = document.getElementById('terms-dashboard');
                if (d) d.classList.remove('hidden');
            }
            if (typeof setupScrollReveal === 'function') setupScrollReveal();
            closeSidePanel(); // Close drawer if open
        });
    });
    // Allow privacy and terms links on auth screen to open their dashboards
    const authFooterLinks = document.querySelectorAll('a[href="#privacy"], a[href="#terms"]');
    authFooterLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const target = e.currentTarget.getAttribute('href');
            const authContainer = document.getElementById('auth-container');
            
            // Only do this special logic if we are on the auth screen
            if (authContainer && !authContainer.classList.contains('hidden')) {
                e.preventDefault();
                authContainer.classList.add('hidden');
                
                const navbar = document.querySelector('.navbar');
                if (navbar) {
                    navbar.classList.remove('hidden');
                    const toggleBtn = document.getElementById('sidebar-toggle');
                    if(toggleBtn) toggleBtn.style.display = 'none'; // hide sidebar on auth view
                    
                    // Add a temporary back button if not exists
                    if(!document.getElementById('auth-back-btn')) {
                        const backBtn = document.createElement('button');
                        backBtn.id = 'auth-back-btn';
                        backBtn.className = 'btn secondary-btn';
                        backBtn.innerHTML = '← Back to Login';
                        backBtn.style.marginRight = '15px';
                        backBtn.onclick = () => {
                            backBtn.style.display = 'none';
                            document.querySelectorAll('.app-wrapper').forEach(d => { if(d) d.classList.add('hidden'); });
                            authContainer.classList.remove('hidden');
                            navbar.classList.add('hidden');
                            window.history.pushState(null, '', window.location.pathname);
                            
                            // Restore navbar elements
                            const menuBtn = document.getElementById('menu-btn');
                            if(menuBtn) menuBtn.style.display = '';
                            const logoutBtn = document.getElementById('logout-btn');
                            if(logoutBtn) logoutBtn.style.display = '';
                            const bell = document.getElementById('notification-bell-container');
                            if(bell) bell.style.display = '';
                            const userEmail = document.getElementById('user-email');
                            if(userEmail) userEmail.style.display = '';
                        };
                        navbar.querySelector('.nav-right').prepend(backBtn);
                    } else {
                        document.getElementById('auth-back-btn').style.display = 'inline-flex';
                    }
                    
                    // Hide sensitive navbar elements for unauthenticated users
                    const menuBtn = document.getElementById('menu-btn');
                    if (menuBtn) menuBtn.style.display = 'none';
                    const logoutBtn = document.getElementById('logout-btn');
                    if (logoutBtn) logoutBtn.style.display = 'none';
                    const bell = document.getElementById('notification-bell-container');
                    if (bell) bell.style.display = 'none';
                    const userEmail = document.getElementById('user-email');
                    if (userEmail) userEmail.style.display = 'none';
                }
                
                document.querySelectorAll('.app-wrapper').forEach(d => { if(d) d.classList.add('hidden'); });
                if (target === '#privacy') {
                    const d = document.getElementById('privacy-dashboard');
                    if (d) d.classList.remove('hidden');
                } else if (target === '#terms') {
                    const d = document.getElementById('terms-dashboard');
                    if (d) d.classList.remove('hidden');
                }
            }
        });
    });

    // --- Data Transfer Logic ---
    const transferModalOverlay = document.getElementById('transfer-modal-overlay');
    const transferModal = document.getElementById('transfer-modal');
    const transferEmail = document.getElementById('transfer-email');
    const transferError = document.getElementById('transfer-error');
    const transferConfirmBtn = document.getElementById('transfer-confirm-btn');
    const transferCancelBtn = document.getElementById('transfer-cancel-btn');

    const acceptTransferOverlay = document.getElementById('accept-transfer-overlay');
    const acceptTransferModal = document.getElementById('accept-transfer-modal');
    const acceptConfirmBtn = document.getElementById('accept-transfer-confirm-btn');
    const acceptCancelBtn = document.getElementById('accept-transfer-cancel-btn');
    const transferSenderEmail = document.getElementById('transfer-sender-email');
    let pendingTransferData = null;

    window.toggleDangerZone = function() {
        const content = document.getElementById('danger-zone-content');
        const chevron = document.getElementById('danger-zone-chevron');
        if (!content) return;
        const isExpanded = content.getAttribute('data-expanded') === 'true';
        if (isExpanded) {
            content.setAttribute('data-expanded', 'false');
            content.style.maxHeight = '0';
            content.style.opacity = '0';
            content.style.paddingTop = '0';
            content.style.paddingBottom = '0';
            content.style.pointerEvents = 'none';
            if (chevron) chevron.style.transform = 'rotate(0deg)';
        } else {
            content.setAttribute('data-expanded', 'true');
            content.style.maxHeight = '650px';
            content.style.opacity = '1';
            content.style.paddingTop = '25px';
            content.style.paddingBottom = '25px';
            content.style.pointerEvents = 'auto';
            if (chevron) chevron.style.transform = 'rotate(180deg)';
        }
    };

    window.openTransferModal = function() {
        closeSidePanel(); // close sidebar if open
        transferEmail.value = '';
        transferError.classList.add('hidden');
        transferModalOverlay.classList.remove('hidden');
        transferModal.classList.remove('hidden');
    };

    function closeTransferModal() {
        transferModalOverlay.classList.add('hidden');
        transferModal.classList.add('hidden');
    }

    if (transferCancelBtn) transferCancelBtn.addEventListener('click', closeTransferModal);
    if (transferModalOverlay) transferModalOverlay.addEventListener('click', closeTransferModal);

    if (transferConfirmBtn) transferConfirmBtn.addEventListener('click', async () => {
        const targetEmail = transferEmail.value.trim();
        if (!targetEmail) {
            transferError.innerText = "❌ Please enter an email address.";
            transferError.classList.remove('hidden');
            return;
        }
        if (targetEmail === currentUserEmail) {
            transferError.innerText = "❌ You cannot transfer data to yourself.";
            transferError.classList.remove('hidden');
            return;
        }

        if (Object.keys(inventory).length === 0) {
            transferError.innerText = "❌ Your inventory is empty. Nothing to transfer!";
            transferError.classList.remove('hidden');
            return;
        }

        transferError.classList.add('hidden');
        transferConfirmBtn.innerHTML = `<span style="display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 8px; vertical-align: -2px;"></span>Verifying...`;
        transferConfirmBtn.disabled = true;
        transferConfirmBtn.style.opacity = '0.8';
        transferConfirmBtn.style.cursor = 'not-allowed';

        try {
            // Check for disposable email
            if (typeof window.isDisposableEmail === 'function') {
                const isDisposable = await window.isDisposableEmail(targetEmail);
                if (isDisposable) {
                    throw new Error("Temporary or disposable email addresses are not allowed.");
                }
            }

            transferConfirmBtn.innerHTML = `<span style="display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 8px; vertical-align: -2px;"></span>Processing...`;

            // Generate payload
            const payload = {
                from: currentUserEmail,
                to: targetEmail,
                i: inventory,
                p: globalPerformance,
                status: 'pending',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Save to Firestore with timeout
            let transferId = "";
            if (typeof db !== 'undefined') {
                try {
                    // Promise.race to timeout if Firestore hangs (e.g. database not created in console)
                    const docRef = await Promise.race([
                        db.collection('transfers').add(payload),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("Database connection timed out. Please ensure Firestore Database is created in Firebase Console.")), 15000))
                    ]);
                    transferId = docRef.id;
                } catch (dbError) {
                    throw dbError;
                }
            } else {
                throw new Error("Database not connected. Cannot process transfer.");
            }
            
            // Generate link with ID instead of payload
            const url = new URL(window.location.href);
            url.searchParams.set('transfer_id', transferId);
            const transferLink = url.toString();

            // Get Firebase Auth Token for security
            let idToken = null;
            try {
                const currentUser = window.auth.currentUser;
                if (currentUser) {
                    idToken = await currentUser.getIdToken(true);
                }
            } catch (tokenErr) {
                console.error("Error getting auth token:", tokenErr);
                throw new Error("Authentication error. Please login again.");
            }
            
            if (!idToken) {
                throw new Error("You must be logged in to send a transfer.");
            }

            // Initialize API Call (relative URL for Vercel Serverless Function)
            transferConfirmBtn.innerHTML = `<span style="display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 8px; vertical-align: -2px;"></span>Sending email...`;
            
            const response = await fetch('/api/send-transfer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    targetEmail: targetEmail,
                    transferLink: transferLink
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to send email.");
            }
            
            // Create Notifications
            if (typeof window.createNotification === 'function') {
                window.createNotification(targetEmail, "New Data Transfer", `${currentUserEmail} wants to transfer data to you.`, "transfer", transferId);
                window.createNotification(currentUserEmail, "Transfer Sent", `Your data transfer to ${targetEmail} is pending.`, "general", transferId);
            }
            
            transferConfirmBtn.innerHTML = `<span style="display: inline-block; margin-right: 6px; font-size: 1.1rem;">✅</span>Sent Successfully!`;
            transferConfirmBtn.style.background = '#10b981';
            await new Promise(resolve => setTimeout(resolve, 800));
            transferConfirmBtn.style.background = '';

            closeTransferModal();
            showToast(`A secure transfer link has been emailed to <strong>${targetEmail}</strong>.<br><br>They need to open the link to accept the data.`, "success");
        } catch (error) {
            console.error("Transfer error:", error);
            const msg = error.text || error.message || (typeof error === 'string' ? error : "An unexpected error occurred. Check console.");
            transferError.innerText = "❌ Error: " + msg;
            transferError.classList.remove('hidden');
        } finally {
            transferConfirmBtn.innerHTML = "Send Transfer Link";
            transferConfirmBtn.disabled = false;
            transferConfirmBtn.style.opacity = '1';
            transferConfirmBtn.style.cursor = 'pointer';
        }
    });

    // --- Transfer Auth Elements ---
    const transferAuthOverlay = document.getElementById('transfer-auth-overlay');
    const transferAuthModal = document.getElementById('transfer-auth-modal');
    const transferTargetEmailDisplay = document.getElementById('transfer-target-email-display');
    const transferAuthSignupView = document.getElementById('transfer-auth-signup-view');
    const transferAuthLoginView = document.getElementById('transfer-auth-login-view');
    const transferNewPassword = document.getElementById('transfer-new-password');
    const transferLoginPassword = document.getElementById('transfer-login-password');
    const transferAuthSignupBtn = document.getElementById('transfer-auth-signup-btn');
    const transferAuthLoginBtn = document.getElementById('transfer-auth-login-btn');
    const transferAuthCancelBtn = document.getElementById('transfer-auth-cancel-btn');
    const transferAuthError = document.getElementById('transfer-auth-error');

    function closeTransferAuthModal() {
        if (transferAuthOverlay) transferAuthOverlay.classList.add('hidden');
        if (transferAuthModal) transferAuthModal.classList.add('hidden');
        pendingTransferData = null;
        // Clean URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('transfer');
        window.history.replaceState({}, document.title, newUrl.toString());
    }

    if (transferAuthCancelBtn) transferAuthCancelBtn.addEventListener('click', closeTransferAuthModal);
    if (transferAuthOverlay) transferAuthOverlay.addEventListener('click', closeTransferAuthModal);

    function showTransferAuthError(msg) {
        transferAuthError.innerText = "❌ " + msg;
        transferAuthError.classList.remove('hidden');
    }

    async function applyTransferDataAndLogin(email, password, isLogin) {
        try {
            transferAuthError.classList.add('hidden');
            if (isLogin) {
                transferAuthLoginBtn.innerText = "Accepting...";
                transferAuthLoginBtn.disabled = true;
                await auth.signInWithEmailAndPassword(email, password);
            } else {
                transferAuthSignupBtn.innerText = "Creating Account...";
                transferAuthSignupBtn.disabled = true;
                await auth.createUserWithEmailAndPassword(email, password);
            }
            
            // Wait for auth state change to set currentUserEmail
            setTimeout(() => {
                // Overwrite data
                inventory = pendingTransferData.i || {};
                globalPerformance = pendingTransferData.p || { amazon: 0, flipkart: 0, meesho: 0 };
                
                saveInventory();
                if (typeof saveGlobalPerformance === 'function') saveGlobalPerformance();
                
                if (typeof renderInventoryTable === 'function') renderInventoryTable();
                if (typeof renderHotSellingTable === 'function') renderHotSellingTable();
                
                closeTransferAuthModal();
                showToast("Data has been successfully imported to your new account.", "success");
            }, 1000);
            
        } catch (error) {
            let errorMsg = error.message;
            if (error.code === 'auth/email-already-in-use') {
                errorMsg = "Account already exists. Please use the login option.";
                transferAuthSignupView.classList.add('hidden');
                transferAuthLoginView.classList.remove('hidden');
            } else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                errorMsg = "Invalid credentials. Please try again.";
            }
            showTransferAuthError(errorMsg);
            transferAuthLoginBtn.innerText = "Login & Accept";
            transferAuthLoginBtn.disabled = false;
            transferAuthSignupBtn.innerText = "Create Account & Accept";
            transferAuthSignupBtn.disabled = false;
        }
    }

    if (transferAuthSignupBtn) transferAuthSignupBtn.addEventListener('click', () => {
        const pass = transferNewPassword.value;
        if (pass.length < 6) return showTransferAuthError("Password must be at least 6 characters.");
        applyTransferDataAndLogin(pendingTransferData.to, pass, false);
    });

    if (transferAuthLoginBtn) transferAuthLoginBtn.addEventListener('click', () => {
        const pass = transferLoginPassword.value;
        if (!pass) return showTransferAuthError("Please enter your password.");
        applyTransferDataAndLogin(pendingTransferData.to, pass, true);
    });

    // Check for transfer URL on load/auth change
    window.checkForPendingTransfers = async function() {
        const urlParams = new URLSearchParams(window.location.search);
        const transferParam = urlParams.get('transfer_id');
        
        if (transferParam) {
            try {
                if (!db) throw new Error("Database not connected.");
                const docRef = await db.collection('transfers').doc(transferParam).get();
                if (!docRef.exists) throw new Error("Transfer not found or expired.");
                
                pendingTransferData = docRef.data();
                pendingTransferData.id = transferParam;
                
                if (pendingTransferData.status !== 'pending') {
                    throw new Error("This transfer link has already been used or cancelled.");
                }
                
                // Check for 10-minute expiration
                if (pendingTransferData.timestamp) {
                    const timestampMs = pendingTransferData.timestamp.toMillis ? pendingTransferData.timestamp.toMillis() : new Date(pendingTransferData.timestamp).getTime();
                    if (Date.now() - timestampMs > 10 * 60 * 1000) {
                        await db.collection('transfers').doc(transferParam).update({ status: 'expired' });
                        if (typeof window.createNotification === 'function') {
                            window.createNotification(pendingTransferData.from, "Transfer Timeout", "The data transfer you sent has timed out.", "timeout", transferParam);
                        }
                        throw new Error("This transfer link has expired (10 min limit).");
                    }
                }
                
                // If they are already logged in as the target email
                if (currentUserEmail === pendingTransferData.to) {
                    transferSenderEmail.innerText = pendingTransferData.from;
                    acceptTransferOverlay.classList.remove('hidden');
                    acceptTransferModal.classList.remove('hidden');
                } else {
                    // Show Auth Transfer Modal
                    // If logged in as someone else, log them out first
                    if (currentUserEmail !== 'default' && currentUserEmail !== '') {
                        auth.signOut();
                    }
                    
                    document.getElementById('auth-overlay').classList.add('hidden');
                    document.getElementById('auth-modal').classList.add('hidden');
                    
                    transferTargetEmailDisplay.innerText = pendingTransferData.to;
                    transferAuthOverlay.classList.remove('hidden');
                    transferAuthModal.classList.remove('hidden');
                    
                    // We assume they don't have an account by default
                    transferAuthSignupView.classList.remove('hidden');
                    transferAuthLoginView.classList.add('hidden');
                }
                
            } catch (e) {
                console.error("Failed to load transfer data:", e);
                showToast(e.message || "Invalid transfer link.", "error");
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.delete('transfer_id');
                window.history.replaceState({}, document.title, newUrl.toString());
            }
        }
    };

    function closeAcceptModal() {
        if (acceptTransferOverlay) acceptTransferOverlay.classList.add('hidden');
        if (acceptTransferModal) acceptTransferModal.classList.add('hidden');
        pendingTransferData = null;
        // Clean up URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('transfer_id');
        window.history.replaceState({}, document.title, newUrl.toString());
    }

    if (acceptCancelBtn) acceptCancelBtn.addEventListener('click', async () => {
        if (pendingTransferData && pendingTransferData.status === 'pending') {
            try {
                await db.collection('transfers').doc(pendingTransferData.id).update({
                    status: 'rejected',
                    rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                if (typeof window.createNotification === 'function') {
                    window.createNotification(pendingTransferData.from, "Transfer Rejected", `${pendingTransferData.to} has declined your data transfer.`, "rejected", pendingTransferData.id);
                }
            } catch (e) {
                console.error("Error rejecting transfer:", e);
            }
        }
        closeAcceptModal();
    });

    if (acceptConfirmBtn) acceptConfirmBtn.addEventListener('click', async () => {
        if (pendingTransferData) {
            // Update Firestore Status
            if (db && pendingTransferData.id) {
                try {
                    await db.collection('transfers').doc(pendingTransferData.id).update({
                        status: 'accepted',
                        acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    if (typeof window.createNotification === 'function') {
                        window.createNotification(pendingTransferData.from, "Transfer Accepted", `${pendingTransferData.to} has accepted your data transfer.`, "success", pendingTransferData.id);
                        window.createNotification(pendingTransferData.to, "Transfer Complete", `You successfully accepted the data from ${pendingTransferData.from}.`, "success", pendingTransferData.id);
                    }
                } catch (e) {
                    console.error("Error updating transfer status:", e);
                }
            }
            
            // Overwrite data
            inventory = pendingTransferData.i || {};
            globalPerformance = pendingTransferData.p || { amazon: 0, flipkart: 0, meesho: 0 };
            
            saveInventory();
            if (typeof saveGlobalPerformance === 'function') saveGlobalPerformance();
            
            if (typeof renderInventoryTable === 'function') renderInventoryTable();
            if (typeof renderHotSellingTable === 'function') renderHotSellingTable();
            
            closeAcceptModal();
            showToast("Data has been successfully imported and saved.", "success");
        }
    });

    // --- Data Clearing Logic ---
    window.clearUserData = function() {
        showConfirm(
            "Clear All Data?", 
            "Are you sure you want to clear your data? This action is irreversible and your data cannot be recovered.", 
            () => {
                if (typeof currentUserEmail !== 'undefined') {
                    // Set to empty object instead of removing, to prevent legacy global data migration on reload
                    inventory = {};
                    localStorage.setItem('inventory_' + currentUserEmail, JSON.stringify(inventory));
                    
                    globalPerformance = { amazon: 0, flipkart: 0, meesho: 0 };
                    if (typeof saveGlobalPerformance === 'function') saveGlobalPerformance();
                    
                    if (typeof renderInventoryTable === 'function') renderInventoryTable();
                    if (typeof renderHotSellingTable === 'function') renderHotSellingTable();
                    
                    showToast("Your data has been permanently cleared.", "success");
                }
            },
            "Yes, Clear Data",
            "var(--accent-warning)" // Orange warning color
        );
    };
});

// Initialize liquid-glass.js on the main navbar using the newly added library script
document.addEventListener('DOMContentLoaded', () => {
    const navGlassEl = document.querySelector('#navbar-glass');
    if (navGlassEl && typeof liquidGlass === 'function') {
        window.navGlass = liquidGlass(navGlassEl, {
            scale: -35,
            chroma: 3,
            blur: 8,
            saturate: 1.3,
            mapBlur: 10,
            border: 0.18
        });
    }
    setupScrollReveal();
});

// --- Landing / Marketing Page Scroll Reveal & Count-Up ---
function animateStatCountUp(el, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 4);
        const currentVal = Math.floor(easeProgress * (end - start) + start);
        el.innerText = currentVal.toLocaleString('en-US');
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            el.innerText = end.toLocaleString('en-US');
        }
    };
    window.requestAnimationFrame(step);
}

function setupScrollReveal() {
    const revealElements = document.querySelectorAll('.scroll-reveal, .scroll-count-up');
    if (!revealElements.length) return;

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (entry.target.classList.contains('scroll-reveal')) {
                    entry.target.classList.add('revealed');
                }
                if (entry.target.classList.contains('scroll-count-up') && !entry.target.dataset.counted) {
                    entry.target.dataset.counted = "true";
                    const targetVal = parseInt(entry.target.getAttribute('data-target') || "10000", 10);
                    animateStatCountUp(entry.target, 0, targetVal, 800);
                }
                obs.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: "0px 0px -10px 0px"
    });

    revealElements.forEach(el => observer.observe(el));
}
