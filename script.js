document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('grid-container');
    const addBtn = document.getElementById('add-btn');
    const editModeBtn = document.getElementById('edit-mode-btn');
    const modal = document.getElementById('modal');
    const closeModal = document.querySelector('.close');
    const addForm = document.getElementById('add-form');

    let bookmarks = JSON.parse(localStorage.getItem('devDashboardBookmarks')) || [
        { id: 1, title: 'GitHub', url: 'https://github.com/', category: 'github', size: 'medium', x: 1, y: 1 },
        { id: 2, title: 'Azure', url: 'https://portal.azure.com/', category: 'azure', size: 'medium', x: 3, y: 1 },
        { id: 3, title: 'Stack Overflow', url: 'https://stackoverflow.com/', category: 'other', size: 'small', x: 5, y: 1 }
    ];

    let isEditMode = false;
    let draggedItem = null;
    let editingIndex = null; // Track which item is being edited

    // Grid config
    const GRID_COLS = 6;
    
    function saveBookmarks() {
        localStorage.setItem('devDashboardBookmarks', JSON.stringify(bookmarks));
    }

    function renderBookmarks() {
        gridContainer.innerHTML = '';

        // Calculate grid height based on furthest card
        let maxRow = 1;
        bookmarks.forEach(b => {
             // Handle old data without x,y
             if(!b.x) b.x = 1; 
             if(!b.y) b.y = 1;
             
             const h = (b.size === 'large' ? 2 : 1);
             if (b.y + h - 1 > maxRow) maxRow = b.y + h - 1;
        });

        // Add extra rows for dropping at bottom
        const totalRows = Math.max(maxRow + 2, 4);

        // Render Empty Slots (Background Layer)
        for (let row = 1; row <= totalRows; row++) {
            for (let col = 1; col <= GRID_COLS; col++) {
                const slot = document.createElement('div');
                slot.classList.add('grid-slot');
                slot.style.gridColumnStart = col;
                slot.style.gridRowStart = row;
                slot.dataset.x = col;
                slot.dataset.y = row;
                
                // Drop handlers for empty slots
                addSlotDragEvents(slot);
                
                gridContainer.appendChild(slot);
            }
        }

        // Render Cards (Foreground Layer)
        bookmarks.forEach((bookmark, index) => {
            const card = document.createElement('div');
            card.classList.add('card');
            card.classList.add(`size-${bookmark.size}`);
            card.classList.add(bookmark.category);
            card.setAttribute('draggable', isEditMode);
            card.dataset.index = index;
            
            // Positioning
            // Ensure values exist
            if(!bookmark.x) bookmark.x = 1;
            if(!bookmark.y) bookmark.y = 1;

            card.style.gridColumnStart = bookmark.x;
            card.style.gridRowStart = bookmark.y;
            
            const w = (bookmark.size === 'medium' || bookmark.size === 'large') ? 2 : 1;
            const h = (bookmark.size === 'large') ? 2 : 1;
            
            card.style.gridColumnEnd = `span ${w}`;
            card.style.gridRowEnd = `span ${h}`;
            
            // Z-index higher than slots
            card.style.zIndex = 10;

            // Icon selection
            let iconClass = 'fa-solid fa-link';
            if (bookmark.category === 'github') iconClass = 'fa-brands fa-github';
            if (bookmark.category === 'azure') iconClass = 'fa-solid fa-flask'; // Azure ML approximation
            if (bookmark.category === 'loop') iconClass = 'fa-solid fa-infinity';

            // Card Content
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-icon"><i class="${iconClass}"></i></div>
                    <div class="card-title" title="${bookmark.title}">${bookmark.title}</div>
                </div>
                <!-- URL display removed -->
                <div class="card-content" style="flex-grow: 1;">
                    <!-- Spacer so the whole card is clickable -->
                    <a href="${bookmark.url}" target="_blank" class="card-link" style="display: block; width: 100%; height: 100%; opacity: 0;"></a>
                </div>
                <div class="card-actions">
                    <button class="action-btn edit-btn" onclick="editBookmark(${index})" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn resize-btn" onclick="resizeBookmark(${index})" title="Resize"><i class="fa-solid fa-expand"></i></button>
                    <button class="action-btn delete-btn" onclick="deleteBookmark(${index})" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;

            // Click handling
            const link = card.querySelector('a');
            if (isEditMode) {
                link.style.pointerEvents = 'none';
                card.style.cursor = 'move';
            } else {
                link.style.pointerEvents = 'auto';
                card.style.cursor = 'pointer';
                card.addEventListener('click', (e) => {
                    if (!e.target.closest('a') && !e.target.closest('button') && !isEditMode) {
                        window.open(bookmark.url, '_blank');
                    }
                });
            }

            addCardDragEvents(card, index);
            gridContainer.appendChild(card);
        });
    }

    // Helper: Check for overlapping cards
    function isOverlapping(x, y, w, h, ignoreIndex = -1) {
        return bookmarks.some((b, i) => {
            if (i === ignoreIndex) return false;
            const bw = (b.size === 'medium' || b.size === 'large') ? 2 : 1;
            const bh = (b.size === 'large') ? 2 : 1;
            
            // Check rect intersection
            return (x < b.x + bw && x + w > b.x && y < b.y + bh && y + h > b.y);
        });
    }

    // Find next available spot
    function findFreeSpot(w, h) {
        let y = 1;
        while(true) {
            for(let x=1; x <= GRID_COLS - w + 1; x++) {
                if(!isOverlapping(x, y, w, h)) {
                    return { x, y };
                }
            }
            y++;
        }
    }

    function addSlotDragEvents(slot) {
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            if(!isEditMode) return;
            e.dataTransfer.dropEffect = 'move';
            slot.classList.add('drag-over');
        });

        slot.addEventListener('dragleave', () => {
            slot.classList.remove('drag-over');
        });


        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            if(!isEditMode || draggedItem === null) return;

            const targetX = parseInt(slot.dataset.x);
            const targetY = parseInt(slot.dataset.y);
            
            moveBookmarkFull(draggedItem, targetX, targetY);
            
            draggedItem = null;
        });
    }

    function addCardDragEvents(card, index) {
        card.addEventListener('dragstart', (e) => {
            if (!isEditMode) {
                e.preventDefault();
                return;
            }
            draggedItem = index;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index); // Firefox fix
            setTimeout(() => card.style.opacity = '0.5', 0);
        });

        card.addEventListener('dragend', () => {
            card.style.opacity = '1';
            draggedItem = null;
        });
        
        // Allow dropping on other cards to swap
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            if(!isEditMode || draggedItem === null || draggedItem === index) return;
            
            // If dropped on another card, swap positions
            const source = bookmarks[draggedItem];
            const target = bookmarks[index];
            
            const tempX = source.x;
            const tempY = source.y;
            source.x = target.x;
            source.y = target.y;
            target.x = tempX;
            target.y = tempY;

            // Check if swap causes collision for source at new place (target's old place)
            // It might if sizes differ. 
            // Simplified logic: strict swap anchors. 
            // If they overlap other things, so be it? 
            // Users can fix it manually. Or we can try to be smart.
            // Let's just swap for now.
            
            saveBookmarks();
            renderBookmarks();
            draggedItem = null; 
        });
    }

    function moveBookmarkFull(index, targetX, targetY) {
        const b = bookmarks[index];
        const w = (b.size === 'medium' || b.size === 'large') ? 2 : 1;
        const h = (b.size === 'large') ? 2 : 1;

        // Boundary check
        if(targetX + w - 1 > GRID_COLS) {
            targetX = GRID_COLS - w + 1;
        }

        // Update position
        b.x = targetX;
        b.y = targetY;

        saveBookmarks();
        renderBookmarks();
    }
    
    // Actions
    window.deleteBookmark = (index) => {
        if(confirm('Are you sure you want to remove this bookmark?')) {
            bookmarks.splice(index, 1);
            saveBookmarks();
            renderBookmarks();
        }
    };

    window.resizeBookmark = (index) => {
        const sizes = ['small', 'medium', 'large'];
        const currentSize = bookmarks[index].size || 'medium';
        const nextSize = sizes[(sizes.indexOf(currentSize) + 1) % sizes.length];
        bookmarks[index].size = nextSize;
        saveBookmarks();
        renderBookmarks();
    };

    window.editBookmark = (index) => {
        editingIndex = index;
        const b = bookmarks[index];
        document.getElementById('title').value = b.title;
        document.getElementById('url').value = b.url;
        document.getElementById('category').value = b.category;
        document.getElementById('size').value = b.size;
        
        document.querySelector('#modal h2').textContent = 'Edit Bookmark';
        document.querySelector('#add-form button').textContent = 'Update Bookmark';
        modal.style.display = 'block';
    };

    // UI Event Listeners
    addBtn.addEventListener('click', () => {
        editingIndex = null;
        addForm.reset();
        document.querySelector('#modal h2').textContent = 'Add New Bookmark';
        document.querySelector('#add-form button').textContent = 'Save Bookmark';
        modal.style.display = 'block';
    });

    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target == modal) {
            modal.style.display = 'none';
        }
    });
    
    // When adding or editing
    addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('title').value;
        const url = document.getElementById('url').value;
        const category = document.getElementById('category').value;
        const size = document.getElementById('size').value;
        
        if (editingIndex !== null) {
            // Update existing
            bookmarks[editingIndex].title = title;
            bookmarks[editingIndex].url = url;
            bookmarks[editingIndex].category = category;
            bookmarks[editingIndex].size = size;
            editingIndex = null;
        } else {
            // Add New
            const w = (size === 'medium' || size === 'large') ? 2 : 1;
            const h = (size === 'large') ? 2 : 1;
            
            const pos = findFreeSpot(w, h); // Use function defined above
    
            bookmarks.push({
                id: Date.now(),
                title,
                url,
                category,
                size,
                x: pos.x,
                y: pos.y
            });
        }

        saveBookmarks();
        renderBookmarks();
        addForm.reset();
        modal.style.display = 'none';
        
        // Reset modal state
        document.querySelector('#modal h2').textContent = 'Add New Bookmark';
        document.querySelector('#add-form button').textContent = 'Save Bookmark';
    });

    editModeBtn.addEventListener('click', () => {
        isEditMode = !isEditMode;
        if (isEditMode) {
            editModeBtn.textContent = 'Done Editing';
            editModeBtn.classList.add('primary');
            document.body.classList.add('edit-mode');
        } else {
            editModeBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Layout';
            editModeBtn.classList.remove('primary');
            document.body.classList.remove('edit-mode');
        }
        renderBookmarks();
    });

    // Initial Render
    renderBookmarks();
});
