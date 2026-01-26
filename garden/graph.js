// graph.js - garden graph view

let graphNodes = [];
let graphEdges = [];
let graphState = {
    dragging: null,
    hovering: null,
    panning: false,
    panStart: { x: 0, y: 0 },
    transform: { x: 0, y: 0, scale: 1 },
    alpha: 1,  // simulation "heat" - decays over time
    animationId: null,
    entryProgress: 0,  // 0-1 for entry animation
    exitProgress: 0,
    isClosing: false,
    startTime: 0,
    pulsePhase: 0,
    clickFeedback: null  // { node, startTime }
};

function openGraph() {
    const overlay = document.getElementById('graph-overlay');
    overlay.style.display = 'flex';
    overlay.style.opacity = '0';

    // Reset state
    graphState.transform = { x: 0, y: 0, scale: 1 };
    graphState.entryProgress = 0;
    graphState.exitProgress = 0;
    graphState.isClosing = false;
    graphState.alpha = 1;
    graphState.hovering = null;
    graphState.dragging = null;
    graphState.panning = false;
    graphState.clickFeedback = null;
    graphState.startTime = performance.now();

    // Wait a frame for layout, then init and fade in
    requestAnimationFrame(() => {
        initGraph();
        overlay.style.transition = 'opacity 200ms ease-out';
        overlay.style.opacity = '1';
    });
}

function closeGraph() {
    graphState.isClosing = true;
    const overlay = document.getElementById('graph-overlay');
    overlay.style.transition = 'opacity 150ms ease-out';
    overlay.style.opacity = '0';

    setTimeout(() => {
        overlay.style.display = 'none';
        if (graphState.animationId) {
            cancelAnimationFrame(graphState.animationId);
            graphState.animationId = null;
        }
    }, 150);
}

function initGraph() {
    const canvas = document.getElementById('graph-canvas');
    const ctx = canvas.getContext('2d');

    // set canvas size with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Ensure we have valid dimensions
    const width = rect.width || 800;
    const height = rect.height || 600;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // create nodes from notes
    graphNodes = [];
    graphEdges = [];

    const notes = Object.entries(gardenIndex.notes || {});
    const nodeMap = {};
    const centerX = width / 2;
    const centerY = height / 2;

    // create nodes - start from center for entry animation
    notes.forEach(([id, note], i) => {
        const backlinkCount = (note.backlinks || []).length;
        const angle = (i / notes.length) * Math.PI * 2;
        const spread = Math.min(width, height) * 0.3;
        const node = {
            id,
            title: note.title,
            stage: note.stage,
            backlinkCount,
            // Start positions spread in a circle
            x: centerX + Math.cos(angle) * spread * (0.5 + Math.random() * 0.5),
            y: centerY + Math.sin(angle) * spread * (0.5 + Math.random() * 0.5),
            // Target for smooth transitions
            targetX: 0,
            targetY: 0,
            vx: 0,
            vy: 0,
            // Animation state
            hoverAmount: 0,  // 0-1 for smooth hover transitions
            entryDelay: i * 30,  // staggered entry
            scale: 0  // for entry animation
        };
        graphNodes.push(node);
        nodeMap[id] = node;
    });

    // create edges from links
    notes.forEach(([id, note]) => {
        if (note.links) {
            note.links.forEach(targetId => {
                if (nodeMap[targetId]) {
                    graphEdges.push({
                        source: nodeMap[id],
                        target: nodeMap[targetId]
                    });
                }
            });
        }
    });

    // Interaction handlers
    let dragStartX = 0, dragStartY = 0;
    let didDrag = false;
    let lastClickTime = 0;

    // Convert screen coords to graph coords
    const toGraphCoords = (screenX, screenY) => {
        const t = graphState.transform;
        return {
            x: (screenX - t.x) / t.scale,
            y: (screenY - t.y) / t.scale
        };
    };

    const findNodeAt = (gx, gy) => {
        // Check in reverse order (top nodes first)
        for (let i = graphNodes.length - 1; i >= 0; i--) {
            const node = graphNodes[i];
            const dx = gx - node.x;
            const dy = gy - node.y;
            const nodeRadius = Math.min(6 + node.backlinkCount * 2, 20);
            const hitRadius = nodeRadius + 5;
            if (dx * dx + dy * dy < hitRadius * hitRadius) {
                return node;
            }
        }
        return null;
    };

    canvas.onmousedown = (e) => {
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const { x: gx, y: gy } = toGraphCoords(screenX, screenY);

        dragStartX = screenX;
        dragStartY = screenY;
        didDrag = false;

        const node = findNodeAt(gx, gy);
        if (node) {
            graphState.dragging = node;
            graphState.alpha = 0.8;  // wake up simulation slightly
        } else {
            // Start panning
            graphState.panning = true;
            graphState.panStart = { x: screenX, y: screenY };
        }
    };

    canvas.onmousemove = (e) => {
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const { x: gx, y: gy } = toGraphCoords(screenX, screenY);

        if (graphState.dragging) {
            const movedX = Math.abs(screenX - dragStartX);
            const movedY = Math.abs(screenY - dragStartY);
            if (movedX > 5 || movedY > 5) {
                didDrag = true;
            }
            graphState.dragging.x = gx;
            graphState.dragging.y = gy;
            graphState.dragging.vx = 0;
            graphState.dragging.vy = 0;
        } else if (graphState.panning) {
            const dx = screenX - graphState.panStart.x;
            const dy = screenY - graphState.panStart.y;
            graphState.transform.x += dx;
            graphState.transform.y += dy;
            graphState.panStart = { x: screenX, y: screenY };
            didDrag = true;
        }

        // Update hover state
        const hoveredNode = findNodeAt(gx, gy);
        graphState.hovering = hoveredNode;
        canvas.style.cursor = hoveredNode ? 'pointer' : (graphState.panning ? 'grabbing' : 'grab');
    };

    canvas.onmouseup = (e) => {
        const now = performance.now();

        if (graphState.dragging && !didDrag) {
            const node = graphState.dragging;

            // Click feedback animation
            graphState.clickFeedback = { node, startTime: now };

            // Navigate after brief feedback
            setTimeout(() => {
                closeGraph();
                loadNote(node.id);
            }, 100);
        }

        graphState.dragging = null;
        graphState.panning = false;
    };

    canvas.onmouseleave = () => {
        graphState.hovering = null;
        graphState.panning = false;
    };

    // Double-click to reset view
    canvas.ondblclick = (e) => {
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const { x: gx, y: gy } = toGraphCoords(screenX, screenY);

        // Only reset if not clicking a node
        if (!findNodeAt(gx, gy)) {
            graphState.transform = { x: 0, y: 0, scale: 1 };
        }
    };

    // Mouse wheel zoom
    canvas.onwheel = (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.5, Math.min(2, graphState.transform.scale * zoomFactor));

        // Zoom toward mouse position
        const scaleDiff = newScale - graphState.transform.scale;
        graphState.transform.x -= mouseX * scaleDiff / graphState.transform.scale;
        graphState.transform.y -= mouseY * scaleDiff / graphState.transform.scale;
        graphState.transform.scale = newScale;
    };

    // Escape key to close
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            closeGraph();
            document.removeEventListener('keydown', handleKeyDown);
        }
    };
    document.addEventListener('keydown', handleKeyDown);

    // Handle resize
    let resizeTimeout;
    const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
        }, 100);
    };
    window.addEventListener('resize', handleResize);

    // Start animation
    animateGraph(canvas, ctx, width, height);
}

function animateGraph(canvas, ctx, width, height) {
    if (graphState.isClosing) return;

    const now = performance.now();
    const elapsed = now - graphState.startTime;

    // Update entry animation progress
    graphState.entryProgress = Math.min(1, elapsed / 600);
    graphState.pulsePhase = (now / 1000) % (Math.PI * 2);

    // Apply physics with decaying alpha
    if (graphState.alpha > 0.001) {
        graphNodes.forEach(node => {
            if (node === graphState.dragging) return;

            // Repulsion from other nodes
            graphNodes.forEach(other => {
                if (node === other) return;
                const dx = node.x - other.x;
                const dy = node.y - other.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const minDist = 80;
                if (dist < minDist) {
                    const force = (minDist - dist) / dist * 0.5 * graphState.alpha;
                    node.vx += dx * force;
                    node.vy += dy * force;
                }
            });

            // Attraction to center (gentle)
            node.vx += (width / 2 - node.x) * 0.001 * graphState.alpha;
            node.vy += (height / 2 - node.y) * 0.001 * graphState.alpha;

            // Attraction along edges
            graphEdges.forEach(edge => {
                let other = null;
                if (edge.source === node) other = edge.target;
                else if (edge.target === node) other = edge.source;

                if (other) {
                    const dx = other.x - node.x;
                    const dy = other.y - node.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const targetDist = 100;
                    const force = (dist - targetDist) * 0.002 * graphState.alpha;
                    node.vx += dx / dist * force;
                    node.vy += dy / dist * force;
                }
            });

            // Apply velocity with damping
            node.vx *= 0.9;
            node.vy *= 0.9;
            node.x += node.vx;
            node.y += node.vy;

            // Keep in bounds (with padding)
            const padding = 50;
            node.x = Math.max(padding, Math.min(width - padding, node.x));
            node.y = Math.max(padding, Math.min(height - padding, node.y));
        });

        // Decay alpha (simulation cooling)
        graphState.alpha *= 0.99;
    }

    // Update hover animations
    graphNodes.forEach(node => {
        const isHovered = node === graphState.hovering;
        const targetHover = isHovered ? 1 : 0;
        node.hoverAmount += (targetHover - node.hoverAmount) * 0.2;

        // Entry animation
        const entryTime = Math.max(0, (elapsed - node.entryDelay) / 300);
        node.scale = Math.min(1, easeOutBack(entryTime));
    });

    // Draw
    const t = graphState.transform;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.scale, t.scale);

    // Determine which nodes are connected to hovered node
    const connectedToHover = new Set();
    if (graphState.hovering) {
        connectedToHover.add(graphState.hovering);
        graphEdges.forEach(edge => {
            if (edge.source === graphState.hovering) connectedToHover.add(edge.target);
            if (edge.target === graphState.hovering) connectedToHover.add(edge.source);
        });
    }

    // Draw edges (curved, with hover effects)
    graphEdges.forEach(edge => {
        const isConnectedToHover = graphState.hovering &&
            (edge.source === graphState.hovering || edge.target === graphState.hovering);
        const shouldFade = graphState.hovering && !isConnectedToHover;

        const opacity = shouldFade ? 0.15 : (isConnectedToHover ? 0.9 : 0.4);
        const lineWidth = isConnectedToHover ? 2 : 1;

        ctx.strokeStyle = isConnectedToHover ?
            `rgba(140, 160, 255, ${opacity})` :
            `rgba(100, 120, 180, ${opacity})`;
        ctx.lineWidth = lineWidth;

        // Draw curved edge
        const midX = (edge.source.x + edge.target.x) / 2;
        const midY = (edge.source.y + edge.target.y) / 2;
        const dx = edge.target.x - edge.source.x;
        const dy = edge.target.y - edge.source.y;
        // Perpendicular offset for curve
        const curvature = 0.1;
        const ctrlX = midX - dy * curvature;
        const ctrlY = midY + dx * curvature;

        ctx.beginPath();
        ctx.moveTo(edge.source.x, edge.source.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, edge.target.x, edge.target.y);
        ctx.stroke();
    });

    // Draw nodes
    graphNodes.forEach(node => {
        if (node.scale < 0.01) return;  // Skip nodes not yet visible

        const isHovered = node === graphState.hovering;
        const isCurrent = node.id === currentNote;
        const isConnected = connectedToHover.has(node);
        const shouldFade = graphState.hovering && !isConnected;

        // Calculate radius with hover effect
        const baseRadius = Math.min(6 + node.backlinkCount * 2, 20);
        const hoverScale = 1 + node.hoverAmount * 0.15;

        // Click feedback
        let clickScale = 1;
        if (graphState.clickFeedback && graphState.clickFeedback.node === node) {
            const clickElapsed = now - graphState.clickFeedback.startTime;
            if (clickElapsed < 100) {
                clickScale = 1 - Math.sin(clickElapsed / 100 * Math.PI) * 0.15;
            }
        }

        const radius = baseRadius * node.scale * hoverScale * clickScale;
        const opacity = shouldFade ? 0.3 : 1;

        // Node glow
        if (!shouldFade && radius > 0) {
            const gradient = ctx.createRadialGradient(
                node.x, node.y, radius * 0.5,
                node.x, node.y, radius * 2
            );
            gradient.addColorStop(0, adjustColorOpacity(getStageColor(node.stage), 0.3));
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Node circle
        ctx.fillStyle = adjustColorOpacity(getStageColor(node.stage), opacity);
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Hover ring
        if (node.hoverAmount > 0.01) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${node.hoverAmount * 0.8})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 3 + node.hoverAmount * 2, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Current note pulsing ring
        if (isCurrent && !isHovered) {
            const pulseOpacity = 0.5 + Math.sin(graphState.pulsePhase * 2) * 0.3;
            ctx.strokeStyle = `rgba(255, 204, 0, ${pulseOpacity})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 5, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Label (only show for hovered, current, or larger nodes when not faded)
        const showLabel = isHovered || isCurrent || (baseRadius >= 10 && !shouldFade);
        if (showLabel && node.scale > 0.5) {
            const labelOpacity = isHovered ? 1 : (shouldFade ? 0.3 : 0.8);
            ctx.fillStyle = `rgba(255, 255, 255, ${labelOpacity})`;
            ctx.font = isHovered ? 'bold 11px system-ui, sans-serif' : '10px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            // Text shadow for legibility
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 1;

            ctx.fillText(node.title, node.x, node.y + radius + 6);

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }
    });

    ctx.restore();

    graphState.animationId = requestAnimationFrame(() => animateGraph(canvas, ctx, width, height));
}

// Easing function for entry animation
function easeOutBack(t) {
    if (t >= 1) return 1;
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// Adjust color opacity
function adjustColorOpacity(color, opacity) {
    // Convert hex or rgb to rgba
    if (color.startsWith('#')) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return color.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
}

function getStageColor(stage) {
    switch (stage) {
        case 'seedling': return '#90EE90';
        case 'growing': return '#32CD32';
        case 'evergreen': return '#228B22';
        default: return '#808080';
    }
}
