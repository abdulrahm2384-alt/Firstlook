/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle, Trade, ChartTheme, IndicatorInstance } from '../../types';
import { Drawing, DrawingType, DrawingPoint } from '../../types/drawing';
import { calculatePips } from '../../lib/marketUtils';

export class ChartEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: Candle[] = [];
  private trades: Trade[] = [];
  private indicators: IndicatorInstance[] = [];
  private timeToIdx: Map<number, number> = new Map();
  private timeframe: string = '';
  private symbol: string = '';
  private prefix: string | null = null;
  
  private drawings: Drawing[] = [];
  private selectedDrawingId: string | null = null;
  private draggingPointIdx: number | null = null;
  private currentDrawingType: DrawingType | null = null;
  private activeDrawing: Drawing | null = null;
  private isDrawingToolEnabled: boolean = false;
  private pendingSelectedId: string | null = null;
  private dragDistance: number = 0;
  private isReplay: boolean = false;
  private isSimulating: boolean = false;
  
  private onSelectDrawing: ((drawing: Drawing | null) => void) | null = null;
  private onDrawingsChange: ((drawings: Drawing[]) => void) | null = null;
  private onDrawingComplete: (() => void) | null = null;
  private onDrawingSettingsChange: ((settings: any) => void) | null = null;
  private onViewportChange: ((viewport: { zoom: number, offsetX: number, offsetY: number, yScale: number }) => void) | null = null;
  private onTradeClosed: ((trade: any) => void) | null = null;
  private onDrawingTrigger: ((drawing: Drawing) => void) | null = null;
  
  private offsetX: number = 0; 
  private offsetY: number = 0;
  private zoom: number = 10;
  private yScale: number = 1.0;
  private sidebarWidth: number = 60;
  private lastWidth: number = 0;
  private lastHeight: number = 0;
  
  private onLoadMore?: () => void;
  private isLoadingMore: boolean = false;
  
  private isDragging: boolean = false;
  private isSidebarDragging: boolean = false;
  private lastX: number = 0;
  private lastY: number = 0;
  
  private dragStartCoords: DrawingPoint | null = null;
  private initialPoints: DrawingPoint[] = [];
  private dragStartPx: { x: number, y: number } | null = null;
  
  // Playback markers
  private lastUpdateDataLength: number = 0;
  private newCandleFlashTime: number = 0;
  private lastPricePulse: number = 0;
  
  // Precision Aimer state
  private aimerPos: DrawingPoint | null = null;
  private aimerPx: { x: number; y: number } | null = null;
  private isAimerDragging: boolean = false;
  private lastAimerPointer: { x: number; y: number } | null = null;
  private aimerTapStart: number = 0;
  private aimerTapPos: { x: number; y: number } | null = null;

  // Persistent settings per drawing type
  private lastUsedSettings: Partial<Record<DrawingType, any>> = {
    [DrawingType.TREND_LINE]: { color: '#2962ff', lineWidth: 2 }, 
    [DrawingType.HORIZONTAL_LINE]: { color: '#2962ff', lineWidth: 1 },
    [DrawingType.VERTICAL_LINE]: { color: '#2962ff', lineWidth: 1 },
    [DrawingType.HORIZONTAL_RAY]: { color: '#2962ff', lineWidth: 1 },
    [DrawingType.RECTANGLE]: { strokeColor: '#2962ff', fillColor: '#2962ff33', lineWidth: 1 },
    [DrawingType.BRUSH]: { color: '#2962ff', lineWidth: 2 },
    [DrawingType.PATH]: { color: '#2962ff', lineWidth: 2 },
    [DrawingType.LONG_POSITION]: { profitColor: '#00695c', lossColor: '#c62828', opacity: 0.3 },
    [DrawingType.SHORT_POSITION]: { profitColor: '#00695c', lossColor: '#c62828', opacity: 0.3 },
  };

  private readonly PADDING_RIGHT: number = 60; // Standardized padding for chart area

  public setSymbol(symbol: string) {
    this.symbol = symbol;
  }

  public setPrefix(prefix: string | null) {
    this.prefix = prefix;
  }

  public setTimeframe(tf: string) {
    this.timeframe = tf;
    // Update avgInterval immediately to prevent resizing jumps
    this.avgInterval = this.getTimeframeSeconds();
  }

  private getTimeframeSeconds(): number {
    const tf = (this.timeframe || '1h').toLowerCase();
    if (tf === '1mo') return 2592000;
    
    const unit = tf.slice(-1);
    const val = parseInt(tf.slice(0, -1));
    if (isNaN(val)) return 3600;

    switch (unit) {
      case 'm': return val * 60;
      case 'h': return val * 3600;
      case 'd': return val * 86400;
      case 'w': return val * 604800;
      default: return 3600;
    }
  }

  public setIsReplay(isReplay: boolean) {
    this.isReplay = isReplay;
    if (isReplay) {
      this.drawings.forEach(d => {
        if ((d.type === DrawingType.LONG_POSITION || d.type === DrawingType.SHORT_POSITION) && (!d.status || d.status === 'active')) {
          this.refreshPlacedAt(d);
        }
      });
    }
    this.draw();
  }

  public setIsSimulating(isSimulating: boolean) {
    this.isSimulating = isSimulating;
    if (isSimulating) {
      this.drawings.forEach(d => {
        if ((d.type === DrawingType.LONG_POSITION || d.type === DrawingType.SHORT_POSITION) && (!d.status || d.status === 'active')) {
          this.refreshPlacedAt(d);
        }
      });
    }
    this.draw();
  }

  public setOnDrawingSettingsChange(callback: (settings: any) => void) {
    this.onDrawingSettingsChange = callback;
  }

  public setDrawingSettings(settings: any) {
    if (settings) {
      this.lastUsedSettings = { ...this.lastUsedSettings, ...settings };
    }
  }

  public setOnViewportChange(callback: (v: any) => void) {
    this.onViewportChange = callback;
  }

  public setOnTradeClosed(callback: (trade: any) => void) {
    this.onTradeClosed = callback;
  }

  public setOnDrawingTrigger(callback: (drawing: Drawing) => void) {
    this.onDrawingTrigger = callback;
  }

  public getViewport() {
    return {
      zoom: this.zoom,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      yScale: this.yScale
    };
  }

  public setViewport(zoom?: number, offsetX?: number, offsetY?: number, yScale?: number) {
    if (zoom !== undefined) this.zoom = zoom;
    if (offsetX !== undefined) this.offsetX = offsetX;
    if (offsetY !== undefined) this.offsetY = offsetY;
    if (yScale !== undefined) this.yScale = yScale;
    this.needsRangeUpdate = true;
    this.draw();
  }

  public resetView() {
    this.zoom = 10;
    this.offsetX = 0;
    this.offsetY = 0;
    this.yScale = 1.0;
    this.needsRangeUpdate = true;
    this.draw();
    if (this.onViewportChange) {
      this.onViewportChange({
        zoom: this.zoom,
        offsetX: this.offsetX,
        offsetY: this.offsetY,
        yScale: this.yScale
      });
    }
  }

  private loadSettings() {
    // Relying on external sync instead of local storage
  }

  private saveSettings() {
    if (this.onDrawingSettingsChange) {
      this.onDrawingSettingsChange(this.lastUsedSettings);
    }
  }
  private velocityX: number = 0;
  private velocityY: number = 0;
  private friction: number = 0.5; 
  
  private refreshPlacedAt(d: Drawing) {
    if ((d.type === DrawingType.LONG_POSITION || d.type === DrawingType.SHORT_POSITION)) {
      // STRICT RULE: Never reset a closed trade.
      // If it's already won or lost, it's a historical record and points/status are final.
      if (d.status === 'won' || d.status === 'lost') return;
      
      d.placedAt = this.data[this.data.length - 1]?.time;
      // Reset state so it must be re-triggered by future candles
      d.isTriggered = false;
      d.triggeredAt = undefined;
      d.status = 'active';
      d.statusAt = undefined;
      d.managedStopPrice = undefined;
    }
  }
  
  // Cached values for performance
  private avgInterval: number = 3600;
  private cachedMinP: number = 0;
  private cachedMaxP: number = 0;
  private cachedPriceScale: number = 1;
  private cachedStartIdx: number = 0;
  private cachedEndIdx: number = 0;
  private needsRangeUpdate: boolean = true;
  
  private mouseX: number = -1;
  private mouseY: number = -1;
  private isCrosshairActive: boolean = false;
  private longPressTimer: any = null;
  private indicatorLevels: Array<{ price: number, color: string }> = [];
  private pointers: Map<number, PointerEvent> = new Map();
  private lastPinchDistance: number = 0;
  private theme: ChartTheme = {
    bg: '#FFFFFF',
    grid: '#f1f5f9',
    text: '#64748b',
    upColor: '#10b981',
    upBorder: '#10b981',
    upWick: '#10b981',
    downColor: '#ef4444',
    downBorder: '#ef4444',
    downWick: '#ef4444',
    showGrid: true
  };

  private animationId: number | null = null;
  private pinnedText: string | null = null;

  private canvasWidth: number = 0;
  private canvasHeight: number = 0;
  private canvasRect: DOMRect | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!; 
    this.updateCanvasRect();
    this.loadSettings();
    this.setupEvents();
    this.startAnimationLoop();
  }

  private updateCanvasRect() {
    this.canvasRect = this.canvas.getBoundingClientRect();
    this.canvasWidth = this.canvasRect.width;
    this.canvasHeight = this.canvasRect.height;
  }

  private startAnimationLoop() {
    const loop = () => {
      this.updateMomentum();
      this.draw();
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  private emitViewport() {
    if (this.onViewportChange) {
      this.onViewportChange({
        zoom: this.zoom,
        offsetX: this.offsetX,
        offsetY: this.offsetY,
        yScale: this.yScale
      });
    }
  }

  private updateMomentum() {
    if (this.pointers.size > 0) return;

    let changed = false;
    if (Math.abs(this.velocityX) > 0.05) {
      this.offsetX += this.velocityX / (this.zoom || 1);
      this.velocityX *= 0.85; // Faster decay for momentum
      this.needsRangeUpdate = true;
      changed = true;
    } else {
      this.velocityX = 0;
    }

    if (Math.abs(this.velocityY) > 0.05) {
      if (!this.isSidebarDragging) {
         this.offsetY += this.velocityY;
         this.needsRangeUpdate = true;
         changed = true;
      }
      this.velocityY *= 0.85;
    } else {
      this.velocityY = 0;
    }

    if (isNaN(this.offsetX)) this.offsetX = 0;
    if (isNaN(this.offsetY)) this.offsetY = 0;
    if (isNaN(this.velocityX)) this.velocityX = 0;
    if (isNaN(this.velocityY)) this.velocityY = 0;
    
    if (changed) {
      this.emitViewport();
    }
    this.yScale = Math.max(0.1, Math.min(10, this.yScale));
  }

  private setupEvents() {
    this.canvas.addEventListener('pointerdown', (e) => {
      const x = e.clientX - this.canvasRect!.left;
      const y = e.clientY - this.canvasRect!.top;

      // 0. Precision Aimer logic
      if (this.isDrawingToolEnabled && this.currentDrawingType) {
        this.isAimerDragging = true;
        this.lastAimerPointer = { x: e.clientX, y: e.clientY };
        this.aimerTapStart = Date.now();
        this.aimerTapPos = { x: e.clientX, y: e.clientY };
        
        // Hide normal crosshair when using aimer
        this.isCrosshairActive = false;
        
        this.pointers.set(e.pointerId, e);
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }

      // 2. Hit detection for existing drawings/points
      const hit = this.getHitInfo(x, y);
      this.dragStartPx = { x, y };
      this.dragDistance = 0;
      this.pendingSelectedId = null;

      if (hit) {
        const isAlreadySelected = this.selectedDrawingId === hit.id;
        const drawing = this.drawings.find(d => d.id === hit.id);

        // IMPORTANT: Only allow dragging if the drawing was ALREADY selected.
        // This prevents accidental moves while scrolling or initially selecting a drawing.
        if (isAlreadySelected) {
          const selected = drawing || null;
          this.draggingPointIdx = hit.pointIdx;
          
          // Setup initial drag state for smooth movement
          if (selected && this.draggingPointIdx !== null) {
            const coords = this.getValuesAtCoords(x, y);
            if (coords) {
              this.dragStartCoords = coords;
              this.initialPoints = selected.points.map(p => ({ ...p }));
            }
          }
          
          // Zero out momentum
          this.velocityX = 0;
          this.velocityY = 0;
          
          // Capture pointer and return early so chart doesn't pan
          if (this.draggingPointIdx !== null) {
            this.pointers.set(e.pointerId, e);
            this.canvas.setPointerCapture(e.pointerId);
            return;
          }
        } else {
          // If it was NOT already selected, we set it as pending.
          // It will only be selected if the user releases the pointer without much movement (a tap).
          this.pendingSelectedId = hit.id;
          this.draggingPointIdx = null;
        }
      } else {
          // Record that we clicked background, but don't deselect yet to avoid flickering if scrolling
          this.pendingSelectedId = 'background';
      }

      this.isDragging = true;
      this.isSidebarDragging = x > (this.canvasWidth - this.sidebarWidth);
      
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.velocityX = 0;
      this.velocityY = 0;
      this.pointers.set(e.pointerId, e);
      this.canvas.setPointerCapture(e.pointerId);
      
      // Long press for Crosshair activation (TradingView style)
      if (!this.isSidebarDragging && this.pointers.size === 1) {
        if (this.longPressTimer) clearTimeout(this.longPressTimer);
        this.longPressTimer = setTimeout(() => {
          this.longPressTimer = null; // Important: set to null so move logic knows it finished
          this.isCrosshairActive = true;
          const isTouch = e.pointerType === 'touch';
          const touchOffset = isTouch ? 60 : 0; 
          
          this.mouseX = x;
          this.mouseY = y - touchOffset;
          
          if ('vibrate' in navigator) navigator.vibrate(12);
        }, 500); // 500ms for pro feel
      }

      if (this.pointers.size >= 2) {
        this.isSidebarDragging = false; 
        this.lastPinchDistance = this.getPinchDistance();
        const center = this.getPointerCenter();
        this.lastX = center.x + this.canvasRect!.left;
        this.lastY = center.y + this.canvasRect!.top;
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
      }
    });

    this.canvas.addEventListener('pointerup', (e) => {
      if (this.pendingSelectedId) {
        // If it was a tap (not a significant drag), perform selection/deselection
        if (this.dragDistance < 10) {
          if (this.pendingSelectedId === 'background') {
            if (this.selectedDrawingId) {
              this.selectedDrawingId = null;
              this.onSelectDrawing?.(null);
            }
          } else {
            this.selectedDrawingId = this.pendingSelectedId;
            const selected = this.drawings.find(d => d.id === this.selectedDrawingId);
            if (this.onSelectDrawing && selected) {
              this.onSelectDrawing(JSON.parse(JSON.stringify(selected)));
            }
          }
        }
        this.pendingSelectedId = null;
      }

      if (this.isAimerDragging && this.aimerPos) {
        const duration = Date.now() - this.aimerTapStart;
        const dx = Math.abs(e.clientX - (this.aimerTapPos?.x || 0));
        const dy = Math.abs(e.clientY - (this.aimerTapPos?.y || 0));

        // If it was a quick tap with minimal movement, place the point
        if (duration < 300 && dx < 10 && dy < 10) {
          const coords = this.aimerPos;
          
          if (this.activeDrawing && this.activeDrawing.type === DrawingType.PATH) {
            const firstPoint = this.activeDrawing.points[0];
            const lastFixedPoint = this.activeDrawing.points[this.activeDrawing.points.length - 2];
            const { x: fx, y: fy } = this.getPointCoords(firstPoint);
            const { x: lx, y: ly } = this.getPointCoords(lastFixedPoint);
            const { x: ax, y: ay } = this.getPointCoords(coords);
            
            const distFirst = Math.sqrt((ax - fx)**2 + (ay - fy)**2);
            const distLast = Math.sqrt((ax - lx)**2 + (ay - ly)**2);
            
            if ((distFirst < 15 && this.activeDrawing.points.length > 2) || (distLast < 10)) {
              this.activeDrawing.points.pop();
              this.activeDrawing = null;
              this.onDrawingsChange?.(this.drawings);
              this.onDrawingComplete?.();
            } else {
              this.activeDrawing.points[this.activeDrawing.points.length - 1] = coords;
              this.activeDrawing.points.push(coords);
            }
          } else if (this.activeDrawing) {
             // Second point placed
             this.activeDrawing.points[1] = coords;
             this.activeDrawing = null;
             this.onDrawingsChange?.(this.drawings);
             this.onDrawingComplete?.();
          } else {
            // Start new drawing
            const defaults = this.lastUsedSettings[this.currentDrawingType!] || { color: '#2962ff', lineWidth: 1 };
            let points: DrawingPoint[] = [];
            
            if (this.currentDrawingType === DrawingType.PATH) {
              points = [coords, coords];
            } else if (this.currentDrawingType === DrawingType.LONG_POSITION || this.currentDrawingType === DrawingType.SHORT_POSITION) {
              const isLong = this.currentDrawingType === DrawingType.LONG_POSITION;
              const settings = this.lastUsedSettings[this.currentDrawingType!];
              
              let targetDist: number;
              let stopDist: number;
              let duration: number;

              if (settings?.targetDist && settings?.stopDist) {
                targetDist = settings.targetDist;
                stopDist = settings.stopDist;
                duration = settings.duration || (30 * this.avgInterval);
              } else {
                // Calculate dynamic defaults
                const visiblePriceRange = (this.cachedMaxP - this.cachedMinP) || (coords.price * 0.05);
                targetDist = visiblePriceRange * 0.12; 
                stopDist = targetDist * 0.5;
                const visibleBars = (this.canvasWidth - this.sidebarWidth - 20) / this.zoom;
                duration = (visibleBars * this.avgInterval) * 0.15;
              }
              
              const tPrice = coords.price + (isLong ? 1 : -1) * targetDist;
              const sPrice = coords.price - (isLong ? 1 : -1) * stopDist;
              const endTime = coords.time + duration;
              
              points = [coords, { ...coords, price: tPrice, time: endTime }, { ...coords, price: sPrice, time: endTime }];
            } else {
              points = [coords, coords];
            }

            this.activeDrawing = {
              id: Math.random().toString(36).substr(2, 9),
              symbol: this.symbol,
              prefix: this.prefix || undefined,
              type: this.currentDrawingType!,
              points: points,
              settings: { ...defaults },
              placedAt: (this.isSimulating || this.isReplay) ? (this.data[this.data.length - 1]?.time) : undefined
            };
            this.drawings.push(this.activeDrawing);
            this.selectedDrawingId = this.activeDrawing.id;
            this.onSelectDrawing?.(this.activeDrawing);

            if (this.currentDrawingType === DrawingType.LONG_POSITION || this.currentDrawingType === DrawingType.SHORT_POSITION) {
              this.activeDrawing = null;
              this.onDrawingsChange?.(this.drawings);
              this.onDrawingComplete?.();
            }
          }
        }
        
        this.isAimerDragging = false;
        this.lastAimerPointer = null;
        this.pointers.delete(e.pointerId);
        this.canvas.releasePointerCapture(e.pointerId);
        // Only trigger React state change on final placement
        this.onDrawingsChange?.([...this.drawings]);
        return;
      }

      if (this.activeDrawing) {
        // Path tool stays active until completed (e.g. by double click or Enter)
        if (this.activeDrawing.type === DrawingType.PATH) {
          return;
        }
        
        this.activeDrawing = null;
        this.onDrawingsChange?.([...this.drawings]);
        this.onDrawingComplete?.();
      }
      
      if (this.draggingPointIdx !== null) {
        this.onDrawingsChange?.([...this.drawings]);
        this.draggingPointIdx = null;
      }
      this.dragStartPx = null;

      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      this.isCrosshairActive = false;
      this.pointers.delete(e.pointerId);
      this.canvas.style.cursor = 'default';
      if (this.pointers.size < 2) {
        this.lastPinchDistance = 0;
      }
      if (this.pointers.size === 1) {
        const remaining = Array.from(this.pointers.values())[0];
        this.lastX = remaining.clientX;
        this.lastY = remaining.clientY;
      }
      if (this.pointers.size === 0) {
        this.isDragging = false;
        this.isSidebarDragging = false;
      }
      this.canvas.releasePointerCapture(e.pointerId);
    });

    this.canvas.addEventListener('pointercancel', (e) => {
      this.pointers.delete(e.pointerId);
      this.isDragging = false;
      this.isSidebarDragging = false;
      this.activeDrawing = null;
      this.draggingPointIdx = null;
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.canvasRect) this.updateCanvasRect();
      const x = e.clientX - this.canvasRect!.left;
      const y = e.clientY - this.canvasRect!.top;

      // Update crosshair pos
      this.mouseX = x;
      this.mouseY = y;

      // Case 0: Precision Aimer movement (Relative Drag)
      if (this.isAimerDragging && this.lastAimerPointer && this.aimerPx) {
        const dx = e.clientX - this.lastAimerPointer.x;
        const dy = e.clientY - this.lastAimerPointer.y;
        
        this.aimerPx.x += dx;
        this.aimerPx.y += dy;
        
        // Clamp to chart area (excluding sidebar)
        this.aimerPx.x = Math.max(0, Math.min(this.canvasWidth - this.sidebarWidth, this.aimerPx.x));
        this.aimerPx.y = Math.max(0, Math.min(this.canvasHeight, this.aimerPx.y));
        
        this.aimerPos = this.getValuesAtCoords(this.aimerPx.x, this.aimerPx.y);
        this.lastAimerPointer = { x: e.clientX, y: e.clientY };
        
        // Update phantom point of active drawing to follow aimer
        if (this.activeDrawing && this.aimerPos) {
           if (this.activeDrawing.type === DrawingType.BRUSH) {
             this.activeDrawing.points.push(this.aimerPos);
           } else {
             this.activeDrawing.points[this.activeDrawing.points.length - 1] = this.aimerPos;
           }
        }
        
        return;
      }

      // Case 1: Point or Body dragging of existing drawing
      if (this.draggingPointIdx !== null && this.selectedDrawingId) {
        const dist = this.dragStartPx ? Math.sqrt((x - this.dragStartPx.x)**2 + (y - this.dragStartPx.y)**2) : 0;
        
        const drawing = this.drawings.find(d => d.id === this.selectedDrawingId);
        const isClosed = drawing?.status === 'won' || drawing?.status === 'lost';
        if (drawing?.settings?.locked || isClosed) {
           this.draggingPointIdx = null;
           this.selectedDrawingId = isClosed ? null : this.selectedDrawingId; // Deselect if closed
           return;
        }

        // Drag threshold to prevent accidental move while scrolling (8px)
        if (dist < 8) return;

        // If dragging the BODY of a position drawing, and it's mostly a horizontal movement, 
        // assume it's a chart scroll and cancel the drawing drag
        if (this.draggingPointIdx === -1 && (drawing?.type === DrawingType.LONG_POSITION || drawing?.type === DrawingType.SHORT_POSITION)) {
          const dx = Math.abs(x - (this.dragStartPx?.x || 0));
          const dy = Math.abs(y - (this.dragStartPx?.y || 0));
          if (dx > 50 && dx > dy * 2) {
             this.draggingPointIdx = null;
             this.isDragging = true;
             return;
          }
        }
        
        // Use snap: false for smoother delta calculations during dragging
        const coords = this.getValuesAtCoords(x, y, false);
        if (coords && drawing && this.dragStartCoords && !isNaN(coords.time) && !isNaN(coords.price)) {
          // Locked/Triggered Drawing logic: Restricted Movement
          const isTriggered = drawing.isTriggered;

          if (this.draggingPointIdx === -1) {
            // Whole drawing dragging
            const timeDelta = coords.time - this.dragStartCoords.time;
            const priceDelta = coords.price - this.dragStartCoords.price;
            
            if (!isNaN(timeDelta) && !isNaN(priceDelta)) {
              drawing.points = this.initialPoints.map(p => ({
                time: p.time + timeDelta,
                price: p.price + priceDelta
              }));
              this.refreshPlacedAt(drawing);
            }
          } else if (this.draggingPointIdx >= 0) {
            // Individual point dragging
            if (drawing.type === DrawingType.LONG_POSITION || drawing.type === DrawingType.SHORT_POSITION) {
              const p0 = drawing.points[0];
              const p1 = drawing.points[1];
              const p2 = drawing.points[2] || { ...p0 };
              const lastPrice = this.data[this.data.length - 1]?.close || p0.price;

              if (this.draggingPointIdx === 0 || this.draggingPointIdx === 10) {
                // Dragging Entry Side or Label
                // idx 0 -> Left Handle (Vertical + Start Time)
                // idx 10 -> Entry Line (Vertical Only)
                
                if (!isTriggered) {
                  const priceDelta = coords.price - p0.price;
                  drawing.points[0].price = coords.price;
                  drawing.points[1].price = p1.price + priceDelta;
                  if (drawing.points[2]) drawing.points[2].price = p2.price + priceDelta;
                  this.refreshPlacedAt(drawing);
                }
                
                // If it was the handle (0), also update start time
                if (this.draggingPointIdx === 0) {
                  const minT = Math.min(p0.time, p1.time);
                  if (p0.time === minT) p0.time = coords.time;
                  else p1.time = coords.time;
                  this.refreshPlacedAt(drawing);
                }
                
                // Ensure p2/Stop end time is synchronized
                if (drawing.points[2]) drawing.points[2].time = Math.max(p0.time, p1.time);
                
              } else if (this.draggingPointIdx === 1) {
                // Target Handle
                let newPrice = coords.price;
                if (isTriggered) {
                  const isLong = drawing.type === DrawingType.LONG_POSITION;
                  
                  // Constraint: Cannot cross the managed stop price if set, and definitely cannot cross last price
                  const minPossible = drawing.managedStopPrice !== undefined ? drawing.managedStopPrice : p0.price;
                  
                  if (isLong) {
                    newPrice = Math.max(newPrice, Math.max(minPossible, lastPrice));
                  } else {
                    newPrice = Math.min(newPrice, Math.min(minPossible, lastPrice));
                  }
                }
                drawing.points[1].price = newPrice;
              } else if (this.draggingPointIdx === 2) {
                // Original SL Box Handle
                if (!drawing.points[2]) drawing.points[2] = { ...p0 };
                let newPrice = coords.price;
                if (isTriggered) {
                  const isLong = drawing.type === DrawingType.LONG_POSITION;
                  if (isLong) {
                    // Capped by entry (original logic) AND last price (user request)
                    newPrice = Math.min(newPrice, Math.min(p0.price, lastPrice));
                  } else {
                    newPrice = Math.max(newPrice, Math.max(p0.price, lastPrice));
                  }
                  
                  // GLUE LOGIC: If managedStopPrice was at the same level as original stop, move it too
                  if (drawing.managedStopPrice !== undefined) {
                    const epsilon = 0.00000001;
                    const wasGlued = Math.abs(drawing.managedStopPrice - drawing.points[2].price) < epsilon;
                    
                    // If they are meeting or were already glued, keep them together
                    if (wasGlued) {
                      drawing.managedStopPrice = newPrice;
                    } else {
                      // If price moves "past" the managed price, push the managed price along (collision)
                      if (isLong) {
                        if (newPrice > drawing.managedStopPrice) drawing.managedStopPrice = newPrice;
                      } else {
                        if (newPrice < drawing.managedStopPrice) drawing.managedStopPrice = newPrice;
                      }
                    }
                  }
                }
                drawing.points[2].price = newPrice;
              } else if (this.draggingPointIdx === 5) {
                // Managed SL Ray Handle (Only when triggered)
                if (isTriggered) {
                  const tpPrice = p1.price;
                  const isLong = drawing.type === DrawingType.LONG_POSITION;
                  
                  let newPrice = coords.price;

                  // Magnet effect at Entry (Breakeven)
                  const entryPixelY = this.getYFromPrice(p0.price);
                  const mousePixelY = this.getYFromPrice(newPrice);
                  if (Math.abs(mousePixelY - entryPixelY) < 10) {
                      newPrice = p0.price;
                  }

                  // Constraint: Stay strictly within the position boundaries (Original SL to TP)
                  // AND stay within market reach (lastPrice)
                  const originalStopPrice = p2.price;
                  if (isLong) {
                      // Managed SL must be between Box SL and (TP or LastPrice)
                      // Actually, Target must be > lastPrice, so cap is lastPrice
                      const capPrice = Math.min(tpPrice, lastPrice);
                      newPrice = Math.max(originalStopPrice, Math.min(newPrice, capPrice));
                  } else {
                      // Managed SL must be between Box SL (higher) and (TP or LastPrice) (lower)
                      const capPrice = Math.max(tpPrice, lastPrice);
                      newPrice = Math.min(originalStopPrice, Math.max(newPrice, capPrice));
                  }
                  drawing.managedStopPrice = newPrice;
                }
              } else if (this.draggingPointIdx === 3) {
                // Start Time
                drawing.points[0].time = coords.time;
              } else if (this.draggingPointIdx === 4) {
                // Dragging PHYSICAL Right Handle (End Time Only)
                const maxT = Math.max(p0.time, p1.time);
                if (p0.time === maxT) p0.time = coords.time;
                else p1.time = coords.time;
                
                if (drawing.points[2]) drawing.points[2].time = Math.max(p0.time, p1.time);
              }
            } else if (drawing.type === DrawingType.RECTANGLE && drawing.points.length >= 2) {
              if (this.draggingPointIdx === 0) {
                drawing.points[0] = coords;
              } else if (this.draggingPointIdx === 1) {
                drawing.points[1] = coords;
              } else if (this.draggingPointIdx === 2) {
                // Virtual Corner (p0.time, p1.price)
                drawing.points[0].time = coords.time;
                drawing.points[1].price = coords.price;
              } else if (this.draggingPointIdx === 3) {
                // Virtual Corner (p1.time, p0.price)
                drawing.points[1].time = coords.time;
                drawing.points[0].price = coords.price;
              } else if (this.draggingPointIdx === 4) {
                // Left side middle (p0.time change)
                drawing.points[0].time = coords.time;
              } else if (this.draggingPointIdx === 5) {
                // Right side middle (p1.time change)
                drawing.points[1].time = coords.time;
              }
            } else {
              // Default individual point dragging
              drawing.points[this.draggingPointIdx] = coords;
              
              // Constrain 2nd point for horizontal/vertical types
              if (drawing.type === DrawingType.HORIZONTAL_LINE || drawing.type === DrawingType.HORIZONTAL_RAY) {
                const otherIdx = this.draggingPointIdx === 0 ? 1 : 0;
                if (drawing.points[otherIdx]) {
                  drawing.points[otherIdx].price = coords.price;
                }
              } else if (drawing.type === DrawingType.VERTICAL_LINE) {
                const otherIdx = this.draggingPointIdx === 0 ? 1 : 0;
                if (drawing.points[otherIdx]) {
                  drawing.points[otherIdx].time = coords.time;
                }
              }
            }
          }
          // Remove internal redraw call - animation loop handles it
          // Remove real-time onDrawingsChange for smooth performance (only on finish)
        }
        return;
      }

      // Case 2: Active creation dragging
      if (this.activeDrawing && this.isDrawingToolEnabled) {
        const coords = this.getValuesAtCoords(x, y);
        if (coords) {
          if (this.activeDrawing.type === DrawingType.BRUSH) {
            const lastPoint = this.activeDrawing.points[this.activeDrawing.points.length - 1];
            if (lastPoint) {
              const { x: lx, y: ly } = this.getPointCoords(lastPoint);
              const dist = Math.sqrt((x - lx)**2 + (y - ly)**2);
              // Only add point if moved enough (3px) to keep path smooth and manageable
              if (dist > 3) {
                this.activeDrawing.points.push(coords);
              }
            } else {
              this.activeDrawing.points.push(coords);
            }
          } else if (this.activeDrawing.type === DrawingType.PATH) {
            // Update the phantom point during path creation
            this.activeDrawing.points[this.activeDrawing.points.length - 1] = coords;
          } else if (this.activeDrawing.points.length > 1) {
            // Enforce constraints during creation
            if (this.activeDrawing.type === DrawingType.HORIZONTAL_LINE || this.activeDrawing.type === DrawingType.HORIZONTAL_RAY) {
              coords.price = this.activeDrawing.points[0].price;
            } else if (this.activeDrawing.type === DrawingType.VERTICAL_LINE) {
              coords.time = this.activeDrawing.points[0].time;
            } else if (this.activeDrawing.type === DrawingType.LONG_POSITION || this.activeDrawing.type === DrawingType.SHORT_POSITION) {
              // Update Target (point 1) and make Stop (point 2) follow a 1:2 RR ratio initially
              this.activeDrawing.points[1] = coords;
              const entryPrice = this.activeDrawing.points[0].price;
              const targetDiff = coords.price - entryPrice;
              // 1:2 Ratio: If target is +2%, stop is -1%
              this.activeDrawing.points[2] = {
                ...coords,
                price: entryPrice - (targetDiff / 2)
              };
              return;
            }
            this.activeDrawing.points[1] = coords;
          }
        }
        return;
      }

      // Standard panning/pinch-zoom logic
      if (this.dragStartPx) {
        this.dragDistance = Math.sqrt((x - this.dragStartPx.x)**2 + (y - this.dragStartPx.y)**2);
      }

      if (this.longPressTimer && (Math.abs(e.clientX - this.lastX) > 5 || Math.abs(e.clientY - this.lastY) > 5)) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
        this.isCrosshairActive = false; // Suppress crosshair while actively moving
      }

      // Cursor feedback
      if (!this.isDragging) {
        const hit = this.getHitInfo(x, y);
        if (hit) {
          const isSelected = this.selectedDrawingId === hit.id;
          if (isSelected) {
            this.canvas.style.cursor = hit.pointIdx !== -1 ? 'move' : 'pointer';
          } else {
            this.canvas.style.cursor = 'pointer';
          }
        } else if (x > this.canvasWidth - this.sidebarWidth) {
          this.canvas.style.cursor = 'ns-resize';
        } else {
          this.canvas.style.cursor = 'crosshair';
        }
      }
      
      this.mouseX = x;
      this.mouseY = y;

      // Desktop: show crosshair on hover
      if (!this.isDragging && e.pointerType === 'mouse' && !this.isAimerDragging) {
        this.isCrosshairActive = true;
      }

      if (this.isDragging) {
        this.pointers.set(e.pointerId, e);

        if (this.activeDrawing && this.isDrawingToolEnabled) {
          const coords = this.getValuesAtCoords(x, y);
          if (coords) {
            if (this.activeDrawing.type === DrawingType.BRUSH) {
              this.activeDrawing.points.push(coords);
            } else {
              // Update second point for standard shapes
              if (this.activeDrawing.points.length === 1) {
                this.activeDrawing.points.push(coords);
              } else {
                this.activeDrawing.points[1] = coords;
              }
            }
          }
          // Drawings update internally, React only notified on interaction finish for performance
          return;
        }

        if (this.isCrosshairActive) {
          // If in crosshair mode, only update crosshair position (with touch offset), don't pan
          const isTouch = e.pointerType === 'touch';
          const touchOffset = isTouch ? 60 : 0;
          this.mouseX = x;
          this.mouseY = y - touchOffset;
          return;
        }

        if (this.pointers.size >= 2) {
          this.isSidebarDragging = false; 
          const center = this.getPointerCenter();
          const currentDistance = this.getPinchDistance();
          
          // Pan to follow finger center movement
          const dx = (center.x + this.canvasRect!.left) - this.lastX;
          const dy = (center.y + this.canvasRect!.top) - this.lastY;
          
          this.offsetX += dx / this.zoom;
          this.offsetY += dy;
          
          // Update tracking coordinates
          this.lastX = center.x + this.canvasRect!.left;
          this.lastY = center.y + this.canvasRect!.top;

          // Handle Zoom relative to current pinch center
          if (this.lastPinchDistance > 0 && Math.abs(currentDistance - this.lastPinchDistance) > 0.5) {
            const zoomFactor = currentDistance / this.lastPinchDistance;
            // Use high sensitivity for "pinned" feel, slightly dampened to filter touch noise
            const activeZoomFactor = 1 + (zoomFactor - 1) * 0.8;
            this.handleZoom(activeZoomFactor, center);
          }
          this.lastPinchDistance = currentDistance;
          
          // Disable momentum during multi-touch for professional feel
          this.velocityX = 0;
          this.velocityY = 0;
        } else if (this.pointers.size === 1) {
          const dx = e.clientX - this.lastX;
          const dy = e.clientY - this.lastY;
          
          // Sensitivity tuning: standard 1:1 tracking for natural feel
          const panSensitivity = 1.0; 

          if (this.isSidebarDragging) {
            // Refined vertical scale sensitivity - Geometric scaling with focal point stability
            const focalY = this.mouseY > 0 ? this.mouseY : this.canvasHeight / 2;
            
            // Capture price at focal point before scaling
            const minP = this.cachedMinP;
            const priceScaleOld = this.cachedPriceScale;
            const priceAtFocal = (this.canvasHeight * 0.9 + this.offsetY - focalY) / priceScaleOld + minP;

            // Increased vertical scale sensitivity for faster response
            const scaleFactor = Math.pow(0.997, dy); 
            this.yScale *= scaleFactor;
            this.calculateVisibleRange(this.canvasWidth, this.canvasHeight);
            
            // Adjust offsetY to keep priceAtFocal at same focalY
            const priceScaleNew = this.cachedPriceScale;
            this.offsetY = focalY - (this.canvasHeight * 0.9 - (priceAtFocal - minP) * priceScaleNew);
            
            this.needsRangeUpdate = true;
          } else {
            // Direct 1:1 panning
            this.offsetX += dx / this.zoom;
            this.offsetY += dy;
            this.needsRangeUpdate = true;
          }
          
          this.emitViewport();

          this.velocityX = dx * 0.15; // Natural momentum
          this.velocityY = dy * 0.15;
          
          this.lastX = e.clientX;
          this.lastY = e.clientY;
        }
      }
    });

    this.canvas.addEventListener('pointerleave', () => {
        this.mouseX = -1;
        this.mouseY = -1;
    });

    this.canvas.addEventListener('dblclick', (e) => {
      // Finish PATH drawing on double click
      if (this.activeDrawing && this.activeDrawing.type === DrawingType.PATH) {
        this.activeDrawing = null;
        this.onDrawingsChange?.(this.drawings);
        this.onDrawingComplete?.();
        this.draw();
        return;
      }

      if (!this.canvasRect) this.updateCanvasRect();
      const x = e.clientX - this.canvasRect!.left;
      if (x > this.canvasWidth - this.sidebarWidth) {
        this.yScale = 1.0;
        this.offsetY = 0;
      }
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.canvasRect) this.updateCanvasRect();
      const x = e.clientX - this.canvasRect!.left;

      if (x > this.canvasWidth - this.sidebarWidth) {
        // Vertical scaling on sidebar Axis - Geometric focal-point scaling 
        const focalY = this.canvasHeight / 2;
        const minP = this.cachedMinP;
        const priceScaleOld = this.cachedPriceScale;
        const priceAtFocal = (this.canvasHeight * 0.9 + this.offsetY - focalY) / priceScaleOld + minP;

        // Increased vertical scaling speed
        const scaleFactor = Math.pow(0.998, e.deltaY);
        this.yScale *= scaleFactor;
        this.calculateVisibleRange(this.canvasWidth, this.canvasHeight);
        
        const priceScaleNew = this.cachedPriceScale;
        this.offsetY = focalY - (this.canvasHeight * 0.9 - (priceAtFocal - minP) * priceScaleNew);
        
        this.needsRangeUpdate = true;
      } else {
        // Horizontal zooming on chart - TV-style geometric zoom
        // Constant geometric factor per pixel of deltaY for smooth feel
        const zoomFactor = Math.pow(0.9985, e.deltaY);
        this.handleZoom(zoomFactor, { x: e.clientX - this.canvasRect!.left, y: e.clientY - this.canvasRect!.top });
      }
    }, { passive: false });

    // Resize Observer for efficient dimension tracking
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === this.canvas) {
          this.updateCanvasRect();
          this.needsRangeUpdate = true;
        }
      }
    });
    ro.observe(this.canvas);

    // Update rect on scroll to keep coordinate calculation accurate
    window.addEventListener('scroll', () => this.updateCanvasRect(), { passive: true });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (this.selectedDrawingId) {
          const selected = this.drawings.find(d => d.id === this.selectedDrawingId);
          const isClosed = selected?.status === 'won' || selected?.status === 'lost';
          
          if (!isClosed) {
            this.drawings = this.drawings.filter(d => d.id !== this.selectedDrawingId);
            this.selectedDrawingId = null;
            this.onDrawingsChange?.(this.drawings);
            this.onSelectDrawing?.(null);
            this.draw();
          }
        }
      }
      if (e.key === 'Enter') {
        if (this.activeDrawing && this.activeDrawing.type === DrawingType.PATH) {
          this.activeDrawing = null;
          this.onDrawingsChange?.(this.drawings);
          this.onDrawingComplete?.();
          this.draw();
        }
      }
      if (e.key === 'Escape') {
        this.activeDrawing = null;
        this.currentDrawingType = null;
        this.onDrawingComplete?.();
        this.draw();
      }
    });
  }

  private formatDate(timestamp: number, options: Intl.DateTimeFormatOptions): string {
    try {
      return new Date(timestamp * 1000).toLocaleString(undefined, {
        ...options,
        timeZone: this.theme.timezone || 'UTC',
        hour12: false
      });
    } catch (e) {
      // Fallback if timezone is invalid
      return new Date(timestamp * 1000).toLocaleString(undefined, {
        ...options,
        timeZone: 'UTC',
        hour12: false
      });
    }
  }

  private getPinchDistance(): number {
    const p = Array.from(this.pointers.values());
    if (p.length < 2) return 0;
    const dx = p[0].clientX - p[1].clientX;
    const dy = p[0].clientY - p[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getPointerCenter() {
    if (!this.canvasRect) this.updateCanvasRect();
    const p = Array.from(this.pointers.values());
    if (p.length < 2) return { x: this.mouseX, y: this.mouseY };
    return {
      x: ((p[0].clientX + p[1].clientX) / 2) - this.canvasRect!.left,
      y: ((p[0].clientY + p[1].clientY) / 2) - this.canvasRect!.top
    };
  }

  private handleZoom(zoomFactor: number, center: { x: number, y: number }) {
    const width = this.canvasWidth;
    const k = width - this.PADDING_RIGHT;
    
    const oldZoom = this.zoom;
    // Cap total zoom range for stability
    const newZoom = Math.max(0.1, Math.min(500, this.zoom * zoomFactor));
    
    if (newZoom === oldZoom) return;

    this.zoom = newZoom;
    this.needsRangeUpdate = true;
    
    // Algebra: To keep the same world point (candle index) under the cursor/pinch center:
    // offsetX_new = offsetX_old + (center.x - k)/newZoom - (center.x - k)/oldZoom
    const delta = (center.x - k) / this.zoom - (center.x - k) / oldZoom;
    
    if (!isNaN(delta) && isFinite(delta)) {
      this.offsetX += delta;
    }
    this.emitViewport();
  }

  private maxVolume: number = 0;
  private tradeIndices: Map<string, { entry: number, exit: number }> = new Map();

  public setData(data: Candle[], trades: Trade[]) {
    const oldLength = this.data.length;
    const lastOldTime = oldLength > 0 ? this.data[oldLength - 1].time : 0;
    const firstOldCandle = oldLength > 0 ? this.data[0] : null;

    this.data = data;
    this.trades = trades;

    const lastNewTime = data.length > 0 ? data[data.length - 1].time : 0;

    if (data.length > oldLength || (lastNewTime > lastOldTime && lastOldTime !== 0)) {
      this.newCandleFlashTime = performance.now();
    }
    this.lastUpdateDataLength = data.length;

    if (firstOldCandle && data.length > oldLength) {
        // Find if old data was prepended
        const newIdx = data.findIndex(c => c.time === firstOldCandle.time);
        if (newIdx > 0) {
            // Data was prepended (History load)
            // Due to offsetX being relative to the end of the array,
            // we do NOT need to change it to keep old candles in place.
        } else if (newIdx === 0) {
            // Data was appended (Real-time update)
            const appendCount = data.length - oldLength;
            // If user has scrolled left (offsetX > 2), keep view stable by increasing offset
            if (this.offsetX > 2) {
                this.offsetX += appendCount;
            }
        }
    }
    
    this.needsRangeUpdate = true;
    this.draw();

    // TRIGGER DETECTION: Check if any un-triggered drawings were hit by the data
    if (data.length > 0) {
      let drawingsChanged = false;

      this.drawings.forEach(d => {
        let justTriggered = false;
        // 1. TRIGGER DETECTION
        if (!d.isTriggered && (d.type === DrawingType.LONG_POSITION || d.type === DrawingType.SHORT_POSITION)) {
          const p0 = d.points[0];
          const p1 = d.points[1];
          if (!p0 || !p1) return;

          const entryPrice = p0.price;
          const startTime = Math.min(p0.time, p1.time);
          const endTime = Math.max(p0.time, p1.time);

          // STRICT RULE: Only check the EXCLUSIVELY NEW candles for triggers
          // This ensures historical candles already on chart don't cause trigger
          const startIdx = oldLength; 
          for (let i = startIdx; i < data.length; i++) {
            const candle = data[i];
            
            // Further safety check with placedAt
            if (d.placedAt && candle.time <= d.placedAt) {
              continue;
            }

            if (candle.time >= startTime && candle.time <= endTime) {
              if (candle.low <= entryPrice && candle.high >= entryPrice) {
                d.isTriggered = true;
                d.triggeredAt = candle.time;
                d.status = 'active';
                d.managedStopPrice = d.points[2]?.price ?? entryPrice;
                drawingsChanged = true;
                justTriggered = true;
                
                // Emit trigger event
                if (this.onDrawingTrigger) {
                  this.onDrawingTrigger(d);
                }
                break; 
              }
            }
          }
        }

        // 2. CLOSING DETECTION: Check if triggered positions were closed
        // PROTECTION: If it just triggered in this loop, skip closing detection for one cycle
        // This allows the UI to catch the trigger and potentially show a setup selection modal
        if (d.isTriggered && d.status === 'active' && !justTriggered) {
          const p0 = d.points[0];
          const p1 = d.points[1];
          const p2 = d.points[2] || p0;
          if (!p0 || !p1) return;

          const entry = p0.price;
          const target = p1.price;
          const originalStopValue = p2.price;
          const isLong = d.type === DrawingType.LONG_POSITION;
          const managedStop = d.managedStopPrice !== undefined ? d.managedStopPrice : originalStopValue;

          let closedStatus: 'won' | 'lost' | null = null;
          let exitPrice = 0;
          let statusAt = 0;

          // STRICT RULE: Only check the NEWLY ADDED candles for closing
          const startIdx = oldLength;
          for (let i = startIdx; i < data.length; i++) {
            const candle = data[i];
            if (candle.time < d.triggeredAt!) continue;

            if (isLong) {
              if (candle.high >= target) {
                closedStatus = 'won';
                exitPrice = target;
                statusAt = candle.time;
                break;
              } else if (candle.low <= managedStop) {
                closedStatus = 'lost';
                exitPrice = managedStop;
                statusAt = candle.time;
                break;
              }
            } else {
              if (candle.low <= target) {
                closedStatus = 'won';
                exitPrice = target;
                statusAt = candle.time;
                break;
              } else if (candle.high >= managedStop) {
                closedStatus = 'lost';
                exitPrice = managedStop;
                statusAt = candle.time;
                break;
              }
            }
          }

          if (closedStatus) {
            d.status = closedStatus;
            d.statusAt = statusAt;
            drawingsChanged = true;

            if (this.onTradeClosed) {
              const risk = Math.abs(entry - originalStopValue) || 0.00000001;
              const reward = Math.abs(exitPrice - entry);
              const rrRaw = (reward / risk) * (closedStatus === 'won' ? 1 : -1);
              const rr = isFinite(rrRaw) ? rrRaw : (closedStatus === 'won' ? 100 : -100); // Cap at 100RR if risk is 0
              
              // Duration
              const diffSec = d.statusAt - d.triggeredAt!;
              const days = Math.floor(diffSec / 86400);
              const hours = Math.floor((diffSec % 86400) / 3600);
              const mins = Math.floor((diffSec % 3600) / 60);
              const duration = (days > 0 ? `${days}d ` : '') + (hours > 0 ? `${hours}h ` : '') + `${mins}m`;

              const tradeInfo = {
                symbol: this.symbol,
                type: isLong ? 'LONG' : 'SHORT',
                entryTime: d.triggeredAt!,
                exitTime: d.statusAt,
                entryPrice: entry,
                exitPrice: exitPrice,
                rr: parseFloat(rr.toFixed(2)),
                pips: calculatePips(this.symbol, entry, exitPrice),
                status: closedStatus === 'won' ? 'TP' : 'SL',
                timeframe: this.timeframe,
                duration: duration,
                setupGrade: d.settings?.setupGrade,
                confluences: d.settings?.confluences,
                notes: d.settings?.notes
              };

              d.settings = { ...d.settings, tradeInfo };

              this.onTradeClosed({
                ...tradeInfo,
                drawingId: d.id,
                timeframe: '?', // Will be set by App
                setupGrade: d.settings?.setupGrade,
                confluences: d.settings?.confluences,
                notes: d.settings?.notes
              });
            }
          }
        }
      });

      if (drawingsChanged) {
        this.onDrawingsChange?.(this.drawings);
      }
    }
    
    // Pre-calculate max volume for performance
    this.maxVolume = 0;
    for (let i = 0; i < data.length; i++) {
        if (data[i].volume > this.maxVolume) this.maxVolume = data[i].volume;
    }
    if (this.maxVolume === 0) this.maxVolume = 1;

    // Pre-calculate avgInterval and trade indices
    const firstCandle = data[0];
    const lastCandle = data[data.length - 1];
    const calculatedInterval = data.length > 1 
      ? (lastCandle.time - firstCandle.time) / (data.length - 1) 
      : this.getTimeframeSeconds();
    
    const theoretical = this.getTimeframeSeconds();
    if (calculatedInterval > theoretical * 3 || calculatedInterval < theoretical * 0.3) {
      this.avgInterval = theoretical;
    } else {
      this.avgInterval = calculatedInterval;
    }

    this.tradeIndices.clear();
    this.timeToIdx.clear();
    for (let i = 0; i < data.length; i++) {
        this.timeToIdx.set(data[i].time, i);
    }
    
    this.needsRangeUpdate = true;
    trades.forEach(t => {
        this.tradeIndices.set(t.id, {
            entry: this.timeToIdx.get(t.entryTime) ?? -1,
            exit: t.exitTime ? (this.timeToIdx.get(t.exitTime) ?? -1) : -1
        });
    });
  }

  public setTheme(theme: ChartTheme) {
    this.theme = { ...this.theme, ...theme };
  }

  public setSelectedDrawingId(id: string | null) {
    this.selectedDrawingId = id;
    this.draw(); // Force redraw to show selection
  }

  public getSelectedDrawingId(): string | null {
    return this.selectedDrawingId;
  }

  public setDrawingTool(type: DrawingType | null) {
    this.currentDrawingType = type;
    this.isDrawingToolEnabled = type !== null;
    
    if (type !== null) {
      // Initialize aimer at center of visible chart if not set
      // Use last known dimensions or get from canvas
      const w = this.lastWidth || this.canvas.width / (window.devicePixelRatio || 1);
      const h = this.lastHeight || this.canvas.height / (window.devicePixelRatio || 1);
      
      const centerX = Math.max(20, (w - this.sidebarWidth) / 2);
      const centerY = Math.max(20, h / 2);
      
      this.aimerPos = this.getValuesAtCoords(centerX, centerY);
      this.aimerPx = { x: centerX, y: centerY };
    } else {
      this.activeDrawing = null;
      this.aimerPos = null;
      this.aimerPx = null;
    }
    this.draw();
  }

  public getDrawings(): Drawing[] {
    return this.drawings;
  }

  public updateDrawing(updatedDrawing: Drawing) {
    this.drawings = this.drawings.map(d => d.id === updatedDrawing.id ? updatedDrawing : d);
    this.draw();
  }

  public setDrawings(drawings: Drawing[]) {
    // Detect if settings were changed to update persistence
    let changed = false;
    drawings.forEach(d => {
      const existing = this.drawings.find(prev => prev.id === d.id);
      if (existing) {
        let drawingChanged = false;
        
        // Settings change
        if (JSON.stringify(existing.settings) !== JSON.stringify(d.settings)) {
          this.lastUsedSettings[d.type] = { ...this.lastUsedSettings[d.type], ...d.settings };
          drawingChanged = true;
        }

        // Points change (Resize state) for Long/Short
        if ((d.type === DrawingType.LONG_POSITION || d.type === DrawingType.SHORT_POSITION) && d.points.length >= 3) {
          const isActuallyClosed = d.status === 'won' || d.status === 'lost';
          
          if (JSON.stringify(existing.points) !== JSON.stringify(d.points)) {
            // STRICT RULE: If drawing moved/resized, reset its state for future candles
            // BUT ONLY IF NOT CLOSED. Closed trades are historical artifacts and shouldn't be reset.
            if (!isActuallyClosed) {
              this.refreshPlacedAt(d);
            }

            const entry = d.points[0].price;
            const target = d.points[1].price;
            const stop = d.points[2].price;
            
            const targetDist = Math.abs(target - entry);
            const stopDist = Math.abs(stop - entry);
            const duration = d.points[1].time - d.points[0].time;
            
            if (targetDist > 0 && stopDist > 0) {
              this.lastUsedSettings[d.type] = {
                ...this.lastUsedSettings[d.type],
                targetDist,
                stopDist,
                duration
              };
              drawingChanged = true;
            }
          }
        }

        if (drawingChanged) changed = true;
      }
    });
    if (changed) {
      this.saveSettings();
    }
    this.drawings = drawings.map(d => {
      // Ensure placedAt is set for positions if missing
      if ((d.type === DrawingType.LONG_POSITION || d.type === DrawingType.SHORT_POSITION) && !d.placedAt) {
        d.placedAt = this.data[this.data.length - 1]?.time;
      }
      return d;
    });
  }

  public clearDrawings() {
    this.drawings = [];
    this.activeDrawing = null;
  }

  private getValuesAtCoords(x: number, y: number, snap: boolean = true): DrawingPoint | null {
    if (!this.canvas || this.data.length === 0) return null;
    const width = this.canvasWidth;
    const height = this.canvasHeight;
    
    if (this.needsRangeUpdate) {
      this.calculateVisibleRange(width, height);
    }

    const paddingRight = this.PADDING_RIGHT;
    const lastIdx = this.data.length - 1;

    // Continuous Index from X
    const index = lastIdx - this.offsetX + (x - (width - paddingRight)) / this.zoom;
    
    // Stable extrapolation logic
    const lastCandle = this.data[lastIdx];
    
    // Price from Y (Continuous)
    const price = (height * 0.9 + this.offsetY - y) / this.cachedPriceScale + this.cachedMinP;
    const time = lastCandle.time + (index - (this.data.length - 1)) * this.avgInterval;

    if (snap) {
      // Snap to nearest candle
      const snapIdx = Math.round(index);
      if (snapIdx >= 0 && snapIdx < this.data.length) {
        return { time: this.data[snapIdx].time, price };
      }
    }

    return { time, price };
  }

  private calculateVisibleRange(width: number, height: number) {
    const paddingRight = this.PADDING_RIGHT;
    const lastIdx = this.data.length - 1;
    this.cachedEndIdx = Math.min(lastIdx, Math.ceil(lastIdx - this.offsetX + (paddingRight / this.zoom) + 10));
    this.cachedStartIdx = Math.max(0, Math.floor(this.cachedEndIdx - (width / this.zoom) - 20));

    let minPriceVisible = Infinity;
    let maxPriceVisible = -Infinity;
    for (let i = this.cachedStartIdx; i <= this.cachedEndIdx; i++) {
        const d = this.data[i];
        if (d) {
            minPriceVisible = Math.min(minPriceVisible, d.low);
            maxPriceVisible = Math.max(maxPriceVisible, d.high);
        }
    }
    
    if (minPriceVisible === Infinity || isNaN(minPriceVisible)) {
        const recent = this.data.slice(-100);
        minPriceVisible = Math.min(...recent.map(d => d.low)) || 0;
        maxPriceVisible = Math.max(...recent.map(d => d.high)) || 100;
    }

    if (minPriceVisible === maxPriceVisible) {
        minPriceVisible -= 1;
        maxPriceVisible += 1;
    }

    const rangeBuffer = (maxPriceVisible - minPriceVisible) * 0.1;
    this.cachedMinP = minPriceVisible - rangeBuffer;
    this.cachedMaxP = maxPriceVisible + rangeBuffer;
    const priceRange = Math.abs(this.cachedMaxP - this.cachedMinP) || 1;
    this.cachedPriceScale = (height * 0.8 * this.yScale) / priceRange;
    this.needsRangeUpdate = false;
  }

  private getPointCoords(p: DrawingPoint): { x: number; y: number } {
    const width = this.canvasWidth;
    const height = this.canvasHeight;
    
    if (this.needsRangeUpdate) {
      this.calculateVisibleRange(width, height);
    }

    const paddingRight = this.PADDING_RIGHT;
    const lastCandle = this.data[this.data.length - 1];
    
    if (!lastCandle) return { x: 0, y: 0 };

    // X calculation: Try exact match first, then interpolate with binary search
    let idx: number;
    const exactIdx = this.timeToIdx.get(p.time);
    if (exactIdx !== undefined) {
      idx = exactIdx;
    } else if (this.data.length > 1) {
      const data = this.data;
      if (p.time <= data[0].time) {
        idx = (p.time - data[0].time) / this.avgInterval;
      } else if (p.time >= data[data.length - 1].time) {
        idx = (p.time - data[data.length - 1].time) / this.avgInterval + (data.length - 1);
      } else {
        // Binary search for bounding candles
        let low = 0;
        let high = data.length - 1;
        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          if (data[mid].time < p.time) low = mid + 1;
          else high = mid - 1;
        }
        const c1 = data[high];
        const c2 = data[low];
        idx = high + (p.time - c1.time) / (c2.time - c1.time);
      }
    } else {
      idx = 0;
    }
    
    const x = (width - paddingRight) - (this.data.length - 1 - idx - this.offsetX) * this.zoom + (this.zoom / 2);
    const y = height * 0.9 + this.offsetY - (p.price - this.cachedMinP) * this.cachedPriceScale;
    
    return { x, y: isNaN(y) ? 0 : y };
  }

  private getYFromPrice(price: number): number {
    const height = this.canvasHeight;
    if (this.needsRangeUpdate) {
      const width = this.canvasWidth;
      this.calculateVisibleRange(width, height);
    }
    return height * 0.9 + this.offsetY - (price - this.cachedMinP) * this.cachedPriceScale;
  }

  public setIndicators(indicators: IndicatorInstance[]) {
    this.indicators = indicators;
  }

  public setPinnedText(text: string | null) {
    this.pinnedText = text;
    this.draw();
  }

  private calculateSMA(period: number): number[] {
    const sma: number[] = [];
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      sum += this.data[i].close;
      if (i >= period) sum -= this.data[i - period].close;
      sma[i] = i >= period - 1 ? sum / period : NaN;
    }
    return sma;
  }

  private calculateEMA(period: number): number[] {
    const ema: number[] = [];
    if (this.data.length === 0) return ema;
    const k = 2 / (period + 1);
    let currentEma = this.data[0].close;
    for (let i = 0; i < this.data.length; i++) {
      currentEma = this.data[i].close * k + currentEma * (1 - k);
      ema[i] = i >= period - 1 ? currentEma : NaN;
    }
    return ema;
  }

  private calculateWMA(period: number): number[] {
    const wma: number[] = [];
    const denominator = (period * (period + 1)) / 2;
    for (let i = 0; i < this.data.length; i++) {
      if (i < period - 1) {
        wma[i] = NaN;
        continue;
      }
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += this.data[i - j].close * (period - j);
      }
      wma[i] = sum / denominator;
    }
    return wma;
  }

  private calculateHMA(period: number): number[] {
    const halfPeriod = Math.floor(period / 2);
    const sqrtPeriod = Math.floor(Math.sqrt(period));
    
    const wmaHalf = this.calculateWMA(halfPeriod);
    const wmaFull = this.calculateWMA(period);
    
    const diff: Candle[] = this.data.map((d, i) => ({
      ...d,
      close: 2 * wmaHalf[i] - wmaFull[i]
    }));
    
    // Calculate WMA of the difference
    const denominator = (sqrtPeriod * (sqrtPeriod + 1)) / 2;
    const hma: number[] = [];
    for (let i = 0; i < diff.length; i++) {
      if (i < sqrtPeriod - 1 || isNaN(diff[i].close)) {
        hma[i] = NaN;
        continue;
      }
      let sum = 0;
      for (let j = 0; j < sqrtPeriod; j++) {
        sum += diff[i - j].close * (sqrtPeriod - j);
      }
      hma[i] = sum / denominator;
    }
    return hma;
  }

  private calculateRSI(period: number): number[] {
    const rsi: number[] = [];
    if (this.data.length < period) return rsi;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const diff = this.data[i].close - this.data[i - 1].close;
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    for (let i = 0; i < this.data.length; i++) {
      if (i < period) {
        rsi[i] = NaN;
        continue;
      }
      
      if (i > period) {
        const diff = this.data[i].close - this.data[i - 1].close;
        const currentGain = diff >= 0 ? diff : 0;
        const currentLoss = diff < 0 ? -diff : 0;
        
        avgGain = (avgGain * (period - 1) + currentGain) / period;
        avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
      }
      
      if (avgLoss === 0) rsi[i] = 100;
      else {
        const rs = avgGain / avgLoss;
        rsi[i] = 100 - (100 / (1 + rs));
      }
    }
    return rsi;
  }

  private calculateATR(period: number): number[] {
    const atr: number[] = [];
    const tr: number[] = [];
    
    for (let i = 0; i < this.data.length; i++) {
      if (i === 0) {
        tr[i] = this.data[i].high - this.data[i].low;
      } else {
        tr[i] = Math.max(
          this.data[i].high - this.data[i].low,
          Math.abs(this.data[i].high - this.data[i - 1].close),
          Math.abs(this.data[i].low - this.data[i - 1].close)
        );
      }
    }
    
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      if (i < period) {
        sum += tr[i];
        atr[i] = NaN;
        if (i === period - 1) atr[i] = sum / period;
      } else {
        atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
      }
    }
    return atr;
  }

  private calculateMACD(fast: number = 12, slow: number = 26, signal: number = 9): { macd: number[], signalLine: number[], histogram: number[] } {
    const fastEma = this.calculateEMA(fast);
    const slowEma = this.calculateEMA(slow);
    const macd: number[] = fastEma.map((v, i) => v - slowEma[i]);
    
    // Calculate signal line (EMA of MACD)
    const signalLine: number[] = [];
    const k = 2 / (signal + 1);
    let currentSignal = 0;
    let sumForInitial = 0;
    
    for (let i = 0; i < macd.length; i++) {
        if (i < slow - 1) {
            signalLine[i] = NaN;
        } else if (i === slow - 1) {
            sumForInitial = macd[i];
            signalLine[i] = macd[i];
            currentSignal = macd[i];
        } else {
            currentSignal = macd[i] * k + currentSignal * (1 - k);
            signalLine[i] = currentSignal;
        }
    }
    
    const histogram = macd.map((v, i) => v - signalLine[i]);
    return { macd, signalLine, histogram };
  }

  private calculateBB(period: number = 20, stdDev: number = 2): { middle: number[], upper: number[], lower: number[] } {
    const middle = this.calculateSMA(period);
    const upper: number[] = [];
    const lower: number[] = [];
    
    for (let i = 0; i < this.data.length; i++) {
      if (i < period - 1) {
        upper[i] = NaN;
        lower[i] = NaN;
        continue;
      }
      
      let sumSq = 0;
      for (let j = 0; j < period; j++) {
        const diff = this.data[i - j].close - middle[i];
        sumSq += diff * diff;
      }
      const sd = Math.sqrt(sumSq / period);
      upper[i] = middle[i] + stdDev * sd;
      lower[i] = middle[i] - stdDev * sd;
    }
    return { middle, upper, lower };
  }

  private calculateSupertrend(period: number = 10, multiplier: number = 3): { supertrend: number[], direction: number[] } {
    const atr = this.calculateATR(period);
    const supertrend: number[] = [];
    const direction: number[] = []; // 1 for long, -1 for short
    
    let upperBand = 0;
    let lowerBand = 0;
    
    for (let i = 0; i < this.data.length; i++) {
        if (i < period) {
            supertrend[i] = NaN;
            direction[i] = 1;
            continue;
        }
        
        const basicUpperBand = (this.data[i].high + this.data[i].low) / 2 + multiplier * atr[i];
        const basicLowerBand = (this.data[i].high + this.data[i].low) / 2 - multiplier * atr[i];
        
        upperBand = (basicUpperBand < upperBand || this.data[i - 1].close > upperBand) 
            ? basicUpperBand 
            : upperBand;
        lowerBand = (basicLowerBand > lowerBand || this.data[i - 1].close < lowerBand) 
            ? basicLowerBand 
            : lowerBand;
            
        if (isNaN(supertrend[i - 1])) {
            supertrend[i] = basicUpperBand;
            direction[i] = 1;
        } else {
            if (direction[i - 1] === 1 && this.data[i].close <= lowerBand) {
                direction[i] = -1;
                supertrend[i] = upperBand;
            } else if (direction[i - 1] === -1 && this.data[i].close >= upperBand) {
                direction[i] = 1;
                supertrend[i] = lowerBand;
            } else {
                direction[i] = direction[i - 1];
                supertrend[i] = direction[i] === 1 ? lowerBand : upperBand;
            }
        }
    }
    return { supertrend, direction };
  }

  private calculateStoch(kPeriod: number = 14, dPeriod: number = 3, slowing: number = 1): { k: number[], d: number[] } {
    const k: number[] = [];
    const d: number[] = [];
    
    for (let i = 0; i < this.data.length; i++) {
        if (i < kPeriod - 1) {
            k[i] = NaN;
            continue;
        }
        
        let highestHigh = -Infinity;
        let lowestLow = Infinity;
        for (let j = 0; j < kPeriod; j++) {
            highestHigh = Math.max(highestHigh, this.data[i - j].high);
            lowestLow = Math.min(lowestLow, this.data[i - j].low);
        }
        
        const rawK = ((this.data[i].close - lowestLow) / (highestHigh - lowestLow || 1)) * 100;
        k[i] = rawK;
    }
    
    // Smooth K and calculate D
    const smoothedK = this.calculateSMA_Array(k, slowing);
    const smoothedD = this.calculateSMA_Array(smoothedK, dPeriod);
    
    return { k: smoothedK, d: smoothedD };
  }

  private calculateSMA_Array(arr: number[], period: number): number[] {
    const res: number[] = [];
    for (let i = 0; i < arr.length; i++) {
        if (i < period - 1 || isNaN(arr[i])) {
            res[i] = NaN;
            continue;
        }
        let sum = 0;
        let count = 0;
        for (let j = 0; j < period; j++) {
            if (!isNaN(arr[i - j])) {
                sum += arr[i - j];
                count++;
            }
        }
        res[i] = count > 0 ? sum / count : NaN;
    }
    return res;
  }

  private calculateMarketStructure(params: Record<string, any>) {
    const candles = this.data;
    if (candles.length === 0) return { sessionBoxes: [], plots: [] };

    const sessionBoxes: any[] = [];
    const plots: any[] = [];

    const time = candles.map(c => c.time);
    const hours = time.map(t => new Date(t * 1000).getHours());

    const sessions = [
      { id: 'London', show: params.showLondon, hours: [params.londonStart ?? 8, params.londonEnd ?? 16], color: params.londonColor || "rgba(0, 255, 0, 0.15)" },
      { id: 'NY', show: params.showNY, hours: [params.nyStart ?? 13, params.nyEnd ?? 21], color: params.nyColor || "rgba(0, 0, 255, 0.15)" },
      { id: 'Asian', show: params.showAsian, hours: [params.asianStart ?? 0, params.asianEnd ?? 8], color: params.asianColor || "rgba(255, 0, 0, 0.15)" }
    ];

    sessions.forEach(session => {
      if (!session.show) return;
      
      let currentBox: any = null;
      for (let i = 0; i < candles.length; i++) {
        // Handle sessions that wrap around midnight (e.g. 21 to 04)
        const start = session.hours[0];
        const end = session.hours[1];
        const h = hours[i];
        const inSession = start < end 
          ? (h >= start && h < end)
          : (h >= start || h < end);
        
        if (inSession) {
          if (!currentBox) {
            currentBox = {
              id: session.id,
              startIdx: i,
              endIdx: i,
              high: candles[i].high,
              low: candles[i].low,
              color: session.color,
              showLabel: params.showSessionLabels ?? true,
              showOutline: params.showOutline ?? true
            };
          } else {
            currentBox.endIdx = i;
            currentBox.high = Math.max(currentBox.high, candles[i].high);
            currentBox.low = Math.min(currentBox.low, candles[i].low);
          }
        } else if (currentBox) {
          sessionBoxes.push(currentBox);
          currentBox = null;
        }
      }
      if (currentBox) sessionBoxes.push(currentBox);
    });

    // Previous Periods High/Low (Accurate)
    const getDateKey = (time: number, periodType: 'day' | 'week' | 'month') => {
      const d = new Date(time * 1000);
      if (periodType === 'day') return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (periodType === 'week') {
        const start = new Date(d);
        start.setHours(0, 0, 0, 0);
        start.setDate(d.getDate() - d.getDay()); // Sunday start of week
        return start.getTime().toString();
      }
      return `${d.getFullYear()}-${d.getMonth()}`;
    };

    const getRays = (periodType: 'day' | 'week' | 'month', count: number, color: string) => {
      const result: any[] = [];
      const periods: { startIdx: number, endIdx: number, high: number, highIdx: number, low: number, lowIdx: number }[] = [];
      let currentKey = '';

      candles.forEach((c, i) => {
        const key = getDateKey(c.time, periodType);
        if (key !== currentKey) {
          periods.push({ startIdx: i, endIdx: i, high: c.high, highIdx: i, low: c.low, lowIdx: i });
          currentKey = key;
        } else {
          const curr = periods[periods.length - 1];
          curr.endIdx = i;
          if (c.high > curr.high) { curr.high = c.high; curr.highIdx = i; }
          if (c.low < curr.low) { curr.low = c.low; curr.lowIdx = i; }
        }
      });

      // Identify the most recent completed period and project onto current
      if (periods.length >= 2) {
        const prev = periods[periods.length - 2];
        const curr = periods[periods.length - 1];
        
        result.push({
          y: prev.high,
          xStart: prev.highIdx,
          xEnd: curr.endIdx,
          color,
          label: `Prev ${periodType.toUpperCase()} High`,
          showLabel: params.showRayLabels ?? true
        });
        result.push({
          y: prev.low,
          xStart: prev.lowIdx,
          xEnd: curr.endIdx,
          color,
          label: `Prev ${periodType.toUpperCase()} Low`,
          showLabel: params.showRayLabels ?? true
        });
      }
      return result;
    };

    const allRays: any[] = [];
    if (params.showPrevDay) allRays.push(...getRays('day', 1, params.prevDayColor || "#000000"));
    if (params.showPrevWeek) allRays.push(...getRays('week', 1, params.prevWeekColor || "#3b82f6"));
    if (params.showPrevMonth) allRays.push(...getRays('month', 1, params.prevMonthColor || "#f59e0b"));

    return { sessionBoxes, rays: allRays };
  }

  private calculateVWAP(): number[] {
    const vwap: number[] = [];
    let cumulativePriceVolume = 0;
    let cumulativeVolume = 0;
    
    for (let i = 0; i < this.data.length; i++) {
        const d = this.data[i];
        const typicalPrice = (d.high + d.low + d.close) / 3;
        cumulativePriceVolume += typicalPrice * d.volume;
        cumulativeVolume += d.volume;
        vwap[i] = cumulativePriceVolume / (cumulativeVolume || 1);
    }
    return vwap;
  }

  private calculateScript(code: string, params: Record<string, any> = {}): any {
    try {
      const candles = this.data;
      if (candles.length === 0) return null;

      // 1. Pre-process "LiteScript"
      let lines = code.split('\n');
      let transformedLines = lines.map(line => {
        let trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//')) return line;
        
        // Auto-add 'let' to assignments if not present
        if (trimmed.includes('=') && !trimmed.startsWith('let ') && !trimmed.startsWith('const ') && !trimmed.startsWith('var ')) {
           if (/^[a-zA-Z_]\w*\s*=/.test(trimmed)) {
             return 'let ' + line;
           }
        }
        return line;
      });

      let lastIdx = transformedLines.length - 1;
      while (lastIdx >= 0 && (!transformedLines[lastIdx].trim() || transformedLines[lastIdx].trim().startsWith('//'))) lastIdx--;
      
      if (lastIdx >= 0) {
        let lastLine = transformedLines[lastIdx].trim();
        if (!lastLine.startsWith('let ') && !lastLine.startsWith('const ') && !lastLine.startsWith('return ') && !lastLine.includes('=')) {
          transformedLines[lastIdx] = 'return ' + transformedLines[lastIdx];
        }
      }

      const transformedCode = transformedLines.join('\n');
      const close = candles.map(c => c.close);
      const high = candles.map(c => c.high);
      const low = candles.map(c => c.low);
      const open = candles.map(c => c.open);
      const volume = candles.map(c => c.volume);
      const time = candles.map(c => c.time);
      const hour = time.map(t => new Date(t * 1000).getHours());
      const dayofweek = time.map(t => new Date(t * 1000).getDay());
      const month = time.map(t => new Date(t * 1000).getMonth() + 1);

      const ta = {
        sma: (src: number[], len: number) => {
          const res = new Array(src.length).fill(NaN);
          let sum = 0;
          for (let i = 0; i < src.length; i++) {
            sum += src[i] || 0;
            if (i >= len) sum -= src[i - len] || 0;
            if (i >= len - 1) res[i] = sum / len;
          }
          return res;
        },
        ema: (src: number[], len: number) => {
          const res = new Array(src.length).fill(NaN);
          const k = 2 / (len + 1);
          let ema = src[0];
          for (let i = 0; i < src.length; i++) {
            ema = (src[i] || 0) * k + (ema || 0) * (1 - k);
            if (i >= len - 1) res[i] = ema;
          }
          return res;
        },
        highest: (src: number[], len: number) => {
          const res = new Array(src.length).fill(NaN);
          for (let i = 0; i < src.length; i++) {
            if (i < len - 1) continue;
            let h = -Infinity;
            for (let j = 0; j < len; j++) h = Math.max(h, src[i - j] || -Infinity);
            res[i] = h;
          }
          return res;
        },
        lowest: (src: number[], len: number) => {
          const res = new Array(src.length).fill(NaN);
          for (let i = 0; i < src.length; i++) {
            if (i < len - 1) continue;
            let l = Infinity;
            for (let j = 0; j < len; j++) l = Math.min(l, src[i - j] || Infinity);
            res[i] = l;
          }
          return res;
        },
        change: (src: number[]) => src.map((v, i) => i === 0 ? 0 : v - src[i - 1]),
        crossover: (s1: number[], s2: number[]) => s1.map((v, i) => i > 0 && s1[i - 1] < s2[i - 1] && s1[i] > s2[i]),
        crossunder: (s1: number[], s2: number[]) => s1.map((v, i) => i > 0 && s1[i - 1] > s2[i - 1] && s1[i] < s2[i]),
        valuewhen: (cond: boolean[], src: number[], n: number = 0) => {
          const res = new Array(src.length).fill(NaN);
          let found: number[] = [];
          for (let i = 0; i < src.length; i++) {
            if (cond[i]) found.push(src[i]);
            if (found.length > n) res[i] = found[found.length - 1 - n];
          }
          return res;
        }
      };

      const contextMap = {
        close, high, low, open, volume, time, hour, dayofweek, month,
        ta,
        input: (defval: any, title: string) => params[title] !== undefined ? params[title] : defval,
        sma: ta.sma, ema: ta.ema, highest: ta.highest, lowest: ta.lowest
      };

      const body = `
        let plots = [];
        let bgcolors = [];
        let hlines = [];
        const plot = (src, color, title) => { const p = { type: 'plot', src, color, title }; plots.push(p); return p; };
        const bgcolor = (color, cond) => { const bg = { type: 'bgcolor', color, cond }; bgcolors.push(bg); return bg; };
        const hline = (price, color, title) => { const h = { type: 'hline', price, color, title }; hlines.push(h); return h; };
        
        const { close, high, low, open, volume, time, hour, dayofweek, month, ta, input, sma, ema, highest, lowest } = arguments[0];
        
        const result = (function() {
          ${transformedCode}
        })();
        
        if (result && Array.isArray(result)) return { plots: [{ src: result }], bgcolors, hlines };
        if (result && result.type === 'plot') return { plots: [result], bgcolors, hlines };
        
        return { plots, bgcolors, hlines };
      `;

      const fn = new Function('ctx', body);
      return fn(contextMap);
    } catch (e) {
      console.error('LiteScript Error:', e);
      return null;
    }
  }

  private renderIndicators(ctx: CanvasRenderingContext2D, startIdx: number, endIdx: number, getX: (i: number) => number, getY: (p: number) => number) {
    this.indicators.forEach(ind => {
      if (!ind.visible) return;

      const renderLine = (values: number[], color: string, width: number) => {
        if (!values || !Array.isArray(values)) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        let first = true;
        for (let i = Math.max(0, startIdx); i <= Math.min(this.data.length - 1, endIdx); i++) {
          if (isNaN(values[i])) continue;
          const x = getX(i) + this.zoom / 2;
          const y = getY(values[i]);
          if (first) { ctx.moveTo(x, y); first = false; }
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };

      if (ind.type === 'SMA' || ind.type === 'EMA' || ind.type === 'WMA' || ind.type === 'HMA') {
        const period = Number(ind.params.period) || 20;
        let values: number[] = [];
        if (ind.type === 'SMA') values = this.calculateSMA(period);
        else if (ind.type === 'EMA') values = this.calculateEMA(period);
        else if (ind.type === 'WMA') values = this.calculateWMA(period);
        else if (ind.type === 'HMA') values = this.calculateHMA(period);
        renderLine(values, ind.color, ind.lineWidth);
      } else if (ind.type === 'SCRIPT' && ind.code) {
        const result = this.calculateScript(ind.code, ind.params);
        if (!result) return;

        // Handle structured output from new engine
        if (result.bgcolors) {
          result.bgcolors.forEach((bg: any) => {
            ctx.fillStyle = bg.color;
            for (let i = startIdx; i <= endIdx; i++) {
              if (bg.cond[i]) {
                const x = getX(i);
                ctx.fillRect(x, 0, this.zoom, this.canvas.height);
              }
            }
          });
        }

        if (result.hlines) {
          result.hlines.forEach((h: any) => {
            const y = getY(h.price);
            ctx.strokeStyle = h.color || ind.color;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width - this.sidebarWidth, y);
            ctx.stroke();
            ctx.setLineDash([]);
          });
        }

        if (result.plots) {
          result.plots.forEach((p: any) => {
            const values = p.src || p;
            renderLine(values, p.color || ind.color, ind.lineWidth);
          });
        }

        // Fallback for simple array returns (old style or single return)
        if (Array.isArray(result)) {
           renderLine(result, ind.color, ind.lineWidth);
        }
        return;
      } else if (ind.type === 'LEVELS') {
        const result = this.calculateMarketStructure(ind.params);
        if (result.sessionBoxes) {
          result.sessionBoxes.forEach((box: any) => {
            if (box.endIdx < startIdx || box.startIdx > endIdx) return;
            const x1 = getX(box.startIdx);
            const x2 = getX(box.endIdx) + this.zoom;
            const y1 = getY(box.high);
            const y2 = getY(box.low);
            ctx.fillStyle = box.color;
            ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
            
            if (box.showOutline) {
              ctx.strokeStyle = box.color.replace(/0\.\d+\)$/, '0.6)'); 
              ctx.lineWidth = 1.5; // Bolder outline
              ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            }

            // Session Label
            if (box.showLabel && x1 >= 0 && x1 < this.canvas.width) {
              ctx.fillStyle = box.color.replace(/0\.\d+\)$/, '0.9)');
              ctx.font = 'bold 8px Inter, sans-serif';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'top';
              ctx.fillText(box.id.toUpperCase(), x1 + 4, y1 + 4);
            }
          });
        }
        if (result.rays) {
          result.rays.forEach((ray: any) => {
            if (ray.xEnd < startIdx || ray.xStart > endIdx) return;
            const y = getY(ray.y);
            const x1 = getX(Math.max(ray.xStart, startIdx));
            const x2 = getX(Math.min(ray.xEnd, endIdx));
            ctx.beginPath();
            ctx.setLineDash([4, 4]); 
            ctx.strokeStyle = ray.color;
            ctx.lineWidth = 1.2;
            ctx.moveTo(x1, y);
            ctx.lineTo(x2 + this.zoom, y);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Render Label at the end of the ray
            if (ray.showLabel && ray.xEnd >= startIdx && ray.xEnd <= endIdx) {
              ctx.fillStyle = ray.color;
              ctx.font = 'bold 8px Inter, sans-serif';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(ray.label, x2 + this.zoom + 8, y);
              
              // Add to sidebar price tags
              this.indicatorLevels.push({ price: ray.y, color: ray.color });
            }
          });
        }
        if (result.plots) {
          result.plots.forEach((p: any) => {
            renderLine(p.src, p.color, ind.lineWidth);
          });
        }
      } else if (ind.type === 'VWAP') {
        const values = this.calculateVWAP();
        renderLine(values, ind.color, ind.lineWidth);
      } else if (ind.type === 'BB') {
        const period = Number(ind.params.period) || 20;
        const stdDev = Number(ind.params.stdDev) || 2;
        const { middle, upper, lower } = this.calculateBB(period, stdDev);
        
        renderLine(middle, ind.color, ind.lineWidth * 0.5);
        renderLine(upper, ind.color, ind.lineWidth);
        renderLine(lower, ind.color, ind.lineWidth);
        
        // Fill between bands
        ctx.fillStyle = ind.color + '1a';
        ctx.beginPath();
        let first = true;
        for (let i = startIdx; i <= endIdx; i++) {
          if (isNaN(upper[i])) continue;
          const x = getX(i) + this.zoom / 2;
          const y = getY(upper[i]);
          if (first) { ctx.moveTo(x, y); first = false; }
          else ctx.lineTo(x, y);
        }
        for (let i = endIdx; i >= startIdx; i--) {
          if (isNaN(lower[i])) continue;
          const x = getX(i) + this.zoom / 2;
          const y = getY(lower[i]);
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      } else if (ind.type === 'SUPERTREND') {
        const period = Number(ind.params.period) || 10;
        const mult = Number(ind.params.multiplier) || 3;
        const { supertrend, direction } = this.calculateSupertrend(period, mult);
        
        ctx.lineWidth = ind.lineWidth * 2;
        for (let i = Math.max(1, startIdx); i <= endIdx; i++) {
          if (isNaN(supertrend[i]) || isNaN(supertrend[i-1])) continue;
          if (direction[i] !== direction[i-1]) continue;
          
          ctx.strokeStyle = direction[i] === 1 ? '#10b981' : '#ef4444';
          ctx.beginPath();
          ctx.moveTo(getX(i-1) + this.zoom / 2, getY(supertrend[i-1]));
          ctx.lineTo(getX(i) + this.zoom / 2, getY(supertrend[i]));
          ctx.stroke();
        }
      } else if (ind.type === 'RSI' || ind.type === 'MACD' || ind.type === 'STOCH' || ind.type === 'ATR') {
        // These are pane indicators. For now, we render them at the bottom 20% of the main chart.
        const canvasHeight = this.canvas.height;
        const paneHeight = canvasHeight * 0.15;
        const paneBottom = canvasHeight - 30; // Above time axis
        const paneTop = paneBottom - paneHeight;
        
        // Draw pane background and border
        ctx.fillStyle = this.theme.bg + 'ee';
        ctx.fillRect(0, paneTop, this.canvas.width - this.sidebarWidth, paneHeight);
        ctx.strokeStyle = this.theme.grid;
        ctx.lineWidth = 1;
        ctx.strokeRect(0, paneTop, this.canvas.width - this.sidebarWidth, paneHeight);
        
        const getYPane = (val: number, min: number, max: number) => {
            const range = max - min || 1;
            return paneBottom - ((val - min) / range) * (paneHeight - 10) - 5;
        };

        if (ind.type === 'RSI') {
            const period = Number(ind.params.period) || 14;
            const values = this.calculateRSI(period);
            
            // RSI specific levels
            ctx.strokeStyle = this.theme.grid;
            ctx.beginPath();
            ctx.moveTo(0, getYPane(70, 0, 100)); ctx.lineTo(this.canvas.width - this.sidebarWidth, getYPane(70, 0, 100));
            ctx.moveTo(0, getYPane(30, 0, 100)); ctx.lineTo(this.canvas.width - this.sidebarWidth, getYPane(30, 0, 100));
            ctx.stroke();
            
            ctx.strokeStyle = ind.color;
            ctx.lineWidth = ind.lineWidth;
            ctx.beginPath();
            let first = true;
            for (let i = startIdx; i <= endIdx; i++) {
                if (isNaN(values[i])) continue;
                const x = getX(i) + this.zoom / 2;
                const y = getYPane(values[i], 0, 100);
                if (first) { ctx.moveTo(x, y); first = false; }
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        } else if (ind.type === 'ATR') {
            const period = Number(ind.params.period) || 14;
            const values = this.calculateATR(period);
            const visibleValues = values.slice(startIdx, endIdx + 1).filter(v => !isNaN(v));
            const min = Math.min(...visibleValues) || 0;
            const max = Math.max(...visibleValues) || 1;
            
            ctx.strokeStyle = ind.color;
            ctx.lineWidth = ind.lineWidth;
            ctx.beginPath();
            let first = true;
            for (let i = startIdx; i <= endIdx; i++) {
                if (isNaN(values[i])) continue;
                const x = getX(i) + this.zoom / 2;
                const y = getYPane(values[i], min, max);
                if (first) { ctx.moveTo(x, y); first = false; }
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        } else if (ind.type === 'MACD') {
            const { macd, signalLine, histogram } = this.calculateMACD();
            const visibleMacd = macd.slice(startIdx, endIdx + 1).concat(signalLine.slice(startIdx, endIdx + 1)).filter(v => !isNaN(v));
            const maxVal = Math.max(...visibleMacd.map(Math.abs)) || 1;
            const min = -maxVal;
            const max = maxVal;
            
            // Histogram
            for (let i = startIdx; i <= endIdx; i++) {
                if (isNaN(histogram[i])) continue;
                const x = getX(i) + 2;
                const yOrigin = getYPane(0, min, max);
                const yBar = getYPane(histogram[i], min, max);
                ctx.fillStyle = histogram[i] >= 0 ? '#10b98188' : '#ef444488';
                ctx.fillRect(x, Math.min(yOrigin, yBar), Math.max(1, this.zoom - 4), Math.abs(yBar - yOrigin));
            }
            
            // MACD Line
            ctx.strokeStyle = ind.color;
            ctx.lineWidth = ind.lineWidth;
            ctx.beginPath();
            let first = true;
            for (let i = startIdx; i <= endIdx; i++) {
                if (isNaN(macd[i])) continue;
                const x = getX(i) + this.zoom / 2;
                const y = getYPane(macd[i], min, max);
                if (first) { ctx.moveTo(x, y); first = false; }
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Signal Line
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = ind.lineWidth;
            ctx.beginPath();
            first = true;
            for (let i = startIdx; i <= endIdx; i++) {
                if (isNaN(signalLine[i])) continue;
                const x = getX(i) + this.zoom / 2;
                const y = getYPane(signalLine[i], min, max);
                if (first) { ctx.moveTo(x, y); first = false; }
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        } else if (ind.type === 'STOCH') {
            const { k, d } = this.calculateStoch();
            
            ctx.strokeStyle = this.theme.grid;
            ctx.beginPath();
            ctx.moveTo(0, getYPane(80, 0, 100)); ctx.lineTo(this.canvas.width - this.sidebarWidth, getYPane(80, 0, 100));
            ctx.moveTo(0, getYPane(20, 0, 100)); ctx.lineTo(this.canvas.width - this.sidebarWidth, getYPane(20, 0, 100));
            ctx.stroke();
            
            // K line
            ctx.strokeStyle = ind.color;
            ctx.lineWidth = ind.lineWidth;
            ctx.beginPath();
            let first = true;
            for (let i = startIdx; i <= endIdx; i++) {
                if (isNaN(k[i])) continue;
                const x = getX(i) + this.zoom / 2;
                const y = getYPane(k[i], 0, 100);
                if (first) { ctx.moveTo(x, y); first = false; }
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // D line
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = ind.lineWidth;
            ctx.beginPath();
            first = true;
            for (let i = startIdx; i <= endIdx; i++) {
                if (isNaN(d[i])) continue;
                const x = getX(i) + this.zoom / 2;
                const y = getYPane(d[i], 0, 100);
                if (first) { ctx.moveTo(x, y); first = false; }
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
      }
    });
  }

  private getPositionMetrics(d: Drawing) {
    const isLong = d.type === DrawingType.LONG_POSITION;
    const p0 = d.points[0];
    const p1 = d.points[1];
    const p2 = d.points[2] || { ...p0, price: isLong ? p0.price - (p1.price - p0.price) : p0.price + (p0.price - p1.price) };
    
    const entry = p0.price;
    const target = p1.price;
    const stop = p2.price;
    const startTime = Math.min(p0.time, p1.time);
    const endTime = Math.max(p0.time, p1.time);

    let hasTriggered = d.isTriggered || false;
    let triggerTime = d.triggeredAt || null;
    let status: 'active' | 'won' | 'lost' = d.status || 'active';
    let statusTime: number | null = d.statusAt || null;

    // PROTECTION: If in simulation/replay and no placedAt exists, we cannot trigger from history
    const strictSimulation = (this.isSimulating || this.isReplay);

    if (!d.status || d.status === 'active') {
        const managedStop = d.managedStopPrice !== undefined ? d.managedStopPrice : stop;
        for (const candle of this.data) {
            if (candle.time < startTime) continue;
            if (candle.time > endTime) break;
            
            // If drawing has a placedAt record, ignore any pre-existing candles
            // STRICT RULE: Only trigger on candles STRICTLY AFTER placedAt
            if (d.placedAt && candle.time <= d.placedAt) continue;
            
            // If strict simulation and NO placedAt, we assume it was just added and can't use history
            if (strictSimulation && !d.placedAt) continue;

            if (!hasTriggered) {
                if (candle.low <= entry && candle.high >= entry) {
                    hasTriggered = true;
                    triggerTime = candle.time;
                } else {
                    continue; 
                }
            }

            if (isLong) {
                if (candle.low <= managedStop) { status = 'lost'; statusTime = candle.time; break; }
                if (candle.high >= target) { status = 'won'; statusTime = candle.time; break; }
            } else {
                if (candle.high >= managedStop) { status = 'lost'; statusTime = candle.time; break; }
                if (candle.low <= target) { status = 'won'; statusTime = candle.time; break; }
            }
        }
    }

    const isClosed = status === 'won' || status === 'lost';
    
    // Shrink the visual width when closed to only show the duration of the trade
    const renderLeftTime = (isClosed && triggerTime) ? triggerTime : startTime;
    const renderRightTime = (isClosed && statusTime) ? statusTime : endTime;

    return {
        isLong,
        entry,
        target,
        stop,
        startTime,
        endTime,
        hasTriggered,
        triggerTime,
        status,
        statusTime,
        isClosed,
        renderLeftTime,
        renderRightTime
    };
  }

  private renderDrawings(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    getX: (idx: number) => number,
    getY: (price: number) => number,
    minP: number,
    priceScale: number
  ) {
    // Context-sensitive X from Time (including stable extrapolation)
    const getXFromTime = (time: number) => {
      // Calculate continuous index
      const lastCandle = this.data[this.data.length - 1];
      const idx = (time - lastCandle.time) / this.avgInterval + (this.data.length - 1);
      return getX(idx) + this.zoom / 2;
    };

    this.drawings.forEach(d => {
      if (d.points.length === 0 || d.settings.hidden) return;

      const isSelected = d.id === this.selectedDrawingId;
      const coords = d.points.map(p => ({
        x: getXFromTime(p.time),
        y: getY(p.price)
      }));

      ctx.strokeStyle = d.settings.color || '#000000';
      const baseWidth = d.settings.lineWidth || 1;
      ctx.lineWidth = baseWidth;
      
      // Line Styles
      if (d.settings.lineStyle === 'dashed') {
        ctx.setLineDash(baseWidth < 1 ? [3, 3] : [5, 5]);
      } else if (d.settings.lineStyle === 'dotted') {
        ctx.setLineDash(baseWidth < 1 ? [1, 2] : [2, 4]);
      } else {
        ctx.setLineDash([]);
      }

      // Restore anchor points for selected drawing
      if (isSelected) {
        let handles = [...coords];
        if (d.type === DrawingType.RECTANGLE && coords.length >= 2) {
          // Add missing 2 corners to handles (virtual points)
          handles.push({ x: coords[0].x, y: coords[1].y }); 
          handles.push({ x: coords[1].x, y: coords[0].y }); 
          
          // Middle handles for left and right edges
          handles.push({ x: coords[0].x, y: (coords[0].y + coords[1].y) / 2 });
          handles.push({ x: coords[1].x, y: (coords[0].y + coords[1].y) / 2 });
        }

        handles.forEach(p => {
          ctx.setLineDash([]); // Anchors are always solid
          ctx.fillStyle = '#4f46e5'; // Indigo color fill for better visibility
          ctx.strokeStyle = '#ffffff'; 
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); // Slightly larger handles
          ctx.fill();
          ctx.stroke();
        });
        
        // Restore dash for the main drawing body
        if (d.settings.lineStyle === 'dashed') {
          ctx.setLineDash(baseWidth < 1 ? [3, 3] : [5, 5]);
        } else if (d.settings.lineStyle === 'dotted') {
          ctx.setLineDash(baseWidth < 1 ? [1, 2] : [2, 4]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.strokeStyle = d.settings.color || '#000000';
        ctx.lineWidth = baseWidth;
      }

      switch (d.type) {
        case DrawingType.TREND_LINE:
          if (coords.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(coords[0].x, coords[0].y);
            ctx.lineTo(coords[1].x, coords[1].y);
            ctx.stroke();
          }
          break;

        case DrawingType.HORIZONTAL_LINE:
          const hy = coords[0].y;
          ctx.beginPath();
          ctx.moveTo(0, hy);
          ctx.lineTo(width - this.sidebarWidth, hy);
          ctx.stroke();
          break;

        case DrawingType.HORIZONTAL_RAY:
          const ry = coords[0].y;
          ctx.beginPath();
          ctx.moveTo(coords[0].x, ry);
          ctx.lineTo(width - this.sidebarWidth, ry);
          ctx.stroke();
          break;

        case DrawingType.VERTICAL_LINE:
          const vx = coords[0].x;
          ctx.beginPath();
          ctx.moveTo(vx, 0);
          ctx.lineTo(vx, height);
          ctx.stroke();
          break;

        case DrawingType.RECTANGLE:
          if (coords.length >= 2) {
            const rx = Math.min(coords[0].x, coords[1].x);
            const ry = Math.min(coords[0].y, coords[1].y);
            const rw = Math.abs(coords[1].x - coords[0].x);
            const rh = Math.abs(coords[1].y - coords[0].y);
            
            // Fill
            ctx.fillStyle = d.settings.fillColor || (d.settings.color ? d.settings.color + '22' : '#2962ff22');
            ctx.fillRect(rx, ry, rw, rh);
            
            // Border
            ctx.strokeStyle = d.settings.strokeColor || d.settings.color || '#2962ff';
            ctx.strokeRect(rx, ry, rw, rh);
          }
          break;

        case DrawingType.BRUSH:
        case DrawingType.PATH:
          if (coords.length >= 2) {
            ctx.beginPath();
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            
            if (d.type === DrawingType.BRUSH) {
              // Smoother Brush using quadratic curves
              ctx.moveTo(coords[0].x, coords[0].y);
              let i;
              for (i = 1; i < coords.length - 2; i++) {
                const xc = (coords[i].x + coords[i + 1].x) / 2;
                const yc = (coords[i].y + coords[i + 1].y) / 2;
                ctx.quadraticCurveTo(coords[i].x, coords[i].y, xc, yc);
              }
              // For the last 2 points
              if (i < coords.length) {
                ctx.quadraticCurveTo(
                  coords[i].x,
                  coords[i].y,
                  coords[coords.length - 1].x,
                  coords[coords.length - 1].y
                );
              }
            } else {
              // Standard Path (Multi-line)
              ctx.moveTo(coords[0].x, coords[0].y);
              for (let i = 1; i < coords.length; i++) {
                ctx.lineTo(coords[i].x, coords[i].y);
              }
              ctx.stroke();
              
              // If actively drawing a path, draw a preview line to current mouse position
              if (this.activeDrawing && d.id === this.activeDrawing.id) {
                ctx.beginPath();
                ctx.moveTo(coords[coords.length - 1].x, coords[coords.length - 1].y);
                ctx.lineTo(this.mouseX, this.mouseY);
                ctx.setLineDash([5, 5]);
                ctx.stroke();
                ctx.setLineDash([]);
              }
              return; // Skip final stroke
            }
            ctx.stroke();
          } else if (d.type === DrawingType.PATH && coords.length === 1 && this.activeDrawing && d.id === this.activeDrawing.id) {
            // Preview for the very first segment
            ctx.beginPath();
            ctx.moveTo(coords[0].x, coords[0].y);
            ctx.lineTo(this.mouseX, this.mouseY);
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          break;

        case DrawingType.FIB_RETRACEMENT:
          if (coords.length >= 2) {
            const p1 = d.points[0];
            const p2 = d.points[1];
            const diff = p2.price - p1.price;
            
            // Default levels if none specified
            const fibLevels = d.settings.levels || [
              { value: 0, color: '#787b86', opacity: 0, visible: true },
              { value: 0.236, color: '#f23645', opacity: 0.1, visible: true },
              { value: 0.382, color: '#ff9800', opacity: 0.1, visible: true },
              { value: 0.5, color: '#4caf50', opacity: 0.1, visible: true },
              { value: 0.618, color: '#089981', opacity: 0.1, visible: true },
              { value: 0.786, color: '#2196f3', opacity: 0.1, visible: true },
              { value: 1, color: '#787b86', opacity: 0.1, visible: true }
            ];

            const left = Math.min(coords[0].x, coords[1].x);
            const right = Math.max(coords[0].x, coords[1].x);
            const w = right - left;
            
            // Draw backgrounds first
            if (d.settings.showBackground !== false) {
              const visibleLevels = fibLevels.filter((l: any) => l.visible).sort((a: any, b: any) => a.value - b.value);
              for (let i = 0; i < visibleLevels.length - 1; i++) {
                const l1 = visibleLevels[i];
                const l2 = visibleLevels[i+1];
                const y1 = getY(p1.price + diff * l1.value);
                const y2 = getY(p1.price + diff * l2.value);
                
                ctx.fillStyle = l2.color + '22'; // 13% opacity approx
                ctx.fillRect(left, Math.min(y1, y2), w, Math.abs(y2 - y1));
              }
            }

            // Draw Trendline (Grayish dotted slanted line)
            ctx.beginPath();
            ctx.setLineDash([2, 4]);
            ctx.strokeStyle = '#787b8688';
            ctx.lineWidth = baseWidth;
            ctx.moveTo(coords[0].x, coords[0].y);
            ctx.lineTo(coords[1].x, coords[1].y);
            ctx.stroke();

            fibLevels.forEach((lvl: any) => {
              if (!lvl.visible) return;
              
              const price = p1.price + diff * lvl.value;
              const y = getY(price);
              
              ctx.beginPath();
              ctx.strokeStyle = lvl.color || d.settings.color || '#787b86';
              ctx.lineWidth = baseWidth;
              
              const style = d.settings.lineStyle || 'solid';
              if (style === 'dashed') ctx.setLineDash([5, 5]);
              else if (style === 'dotted') ctx.setLineDash([2, 3]);
              else ctx.setLineDash([]);
              
              ctx.moveTo(left, y);
              ctx.lineTo(right, y);
              ctx.stroke();
              
              // Labels
              ctx.setLineDash([]);
              ctx.font = '9px sans-serif'; // Slightly smaller font
              ctx.fillStyle = ctx.strokeStyle;
              
              const label = `${lvl.value.toFixed(3)} (${price.toFixed(2)})`;
              const margin = 2; // Reduced margin to hug the "last edge"
              
              // Vertical Label Position
              const vPos = d.settings.labelPos || 'top';
              if (vPos === 'top') ctx.textBaseline = 'bottom';
              else if (vPos === 'bottom') ctx.textBaseline = 'top';
              else ctx.textBaseline = 'middle';

              const yOffset = vPos === 'top' ? -2 : (vPos === 'bottom' ? 2 : 0);
              
              // Label Alignment
              const align = d.settings.labelAlign || 'right'; // left, center, right
              if (align === 'right') {
                ctx.textAlign = 'right';
                ctx.fillText(label, right - margin, y + yOffset);
              } else if (align === 'left') {
                ctx.textAlign = 'left';
                ctx.fillText(label, left + margin, y + yOffset);
              } else {
                ctx.textAlign = 'center';
                ctx.fillText(label, left + w/2, y + yOffset);
              }
            });
          }
          break;

        case DrawingType.LONG_POSITION:
        case DrawingType.SHORT_POSITION:
          if (coords.length >= 2) {
            const metrics = this.getPositionMetrics(d);
            const { isLong, entry, target, stop, startTime, endTime, hasTriggered, triggerTime, status, statusTime, isClosed, renderLeftTime, renderRightTime } = metrics;
            
            const entryY = getY(entry);
            const targetY = getY(target);
            const stopY = getY(stop);

            const profitColor = d.settings.profitColor || '#00695c';
            const lossColor = d.settings.lossColor || '#c62828';
            const baseOpacity = d.settings.opacity || 0.3;

            // Helper to ensure we have a color with specified opacity
            const getColorWithAlpha = (c: string, alpha: number) => {
                const finalAlpha = alpha * baseOpacity;
                if (c.startsWith('rgba')) {
                    const parts = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
                    if (parts) {
                        const r = parts[1];
                        const g = parts[2];
                        const b = parts[3];
                        // If it's already rgba, we respect its internal alpha but multiply by our target modifier
                        const internalAlpha = parts[4] ? parseFloat(parts[4]) : 1;
                        return `rgba(${r}, ${g}, ${b}, ${internalAlpha * alpha})`;
                    }
                }
                if (c.startsWith('#')) {
                    const hex = c.replace('#', '');
                    const r = parseInt(hex.substring(0, 2), 16);
                    const g = parseInt(hex.substring(2, 4), 16);
                    const b = parseInt(hex.substring(4, 6), 16);
                    return `rgba(${r}, ${g}, ${b}, ${finalAlpha})`;
                }
                return c;
            };

            const lastDataTime = this.data[this.data.length - 1]?.time || Date.now();
            const activeEnd = Math.min(endTime, lastDataTime);

            const left = getXFromTime(renderLeftTime);
            const right = getXFromTime(renderRightTime);
            const w = right - left;
            const midX = left + w / 2;

            const outcomeX = right;

            // --- ZONES ---
            ctx.setLineDash([]);
            
            // 1. Base Zones (Representing the full intended range, or the closed range)
            ctx.fillStyle = getColorWithAlpha(profitColor, 1.0); 
            ctx.fillRect(left, Math.min(entryY, targetY), w, Math.abs(targetY - entryY));
            ctx.fillStyle = getColorWithAlpha(lossColor, 1.0); 
            ctx.fillRect(left, Math.min(entryY, stopY), w, Math.abs(stopY - entryY));

            // 2. Dynamic Highlights
            if (hasTriggered) {
                const fillW = w;
                const lastPrice = (status === 'won' ? target : (status === 'lost' ? (d.managedStopPrice ?? stop) : (this.data[this.data.length-1]?.close || entry)));
                const currentY = getY(lastPrice);

                if (isLong) {
                    if (lastPrice >= entry) {
                        ctx.fillStyle = getColorWithAlpha(profitColor, 1.2); 
                        ctx.fillRect(left, Math.min(entryY, currentY), fillW, Math.abs(currentY - entryY));
                    } else {
                        ctx.fillStyle = getColorWithAlpha(lossColor, 1.2);
                        ctx.fillRect(left, Math.min(entryY, currentY), fillW, Math.abs(currentY - entryY));
                    }
                } else {
                    if (lastPrice <= entry) {
                        ctx.fillStyle = getColorWithAlpha(profitColor, 1.2);
                        ctx.fillRect(left, Math.min(entryY, currentY), fillW, Math.abs(currentY - entryY));
                    } else {
                        ctx.fillStyle = getColorWithAlpha(lossColor, 1.2);
                        ctx.fillRect(left, Math.min(entryY, currentY), fillW, Math.abs(currentY - entryY));
                    }
                }
            }

            // Guideline (Path)
            if (hasTriggered && !isClosed) {
                ctx.strokeStyle = '#ffffffaa';
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(left, entryY);
                const lastPrice = this.data[this.data.length - 1]?.close || entry;
                const pathEndPrice = status === 'won' ? target : (status === 'lost' ? (d.managedStopPrice ?? stop) : lastPrice);
                ctx.lineTo(outcomeX, getY(pathEndPrice));
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // --- GUIDELINE & INFRASTRUCTURE ---
            
            // 1. Central Axis & Entry line 
            // User requested these always stay visible even when closed
            ctx.strokeStyle = isClosed ? '#ffffff44' : '#ffffff22';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(midX, Math.min(targetY, stopY));
            ctx.lineTo(midX, Math.max(targetY, stopY));
            ctx.stroke();

            // Entry line (The central horizontal line of the drawing)
            ctx.strokeStyle = isClosed ? '#ffffffaa' : '#ffffff';
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(left, entryY);
            ctx.lineTo(right, entryY);
            ctx.stroke();

            // Entry line extension to the right (only for active or selected)
            if (!isClosed || d.id === this.selectedDrawingId) {
                ctx.strokeStyle = '#ffffff44';
                ctx.setLineDash([2, 4]);
                ctx.beginPath();
                ctx.moveTo(right, entryY);
                ctx.lineTo(this.canvasWidth - this.sidebarWidth, entryY);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // --- TRIGGERED RAYS ---
            // Rays are visible if triggered but the trade is not yet closed
            if (hasTriggered && !isClosed) { 
                ctx.save();
                ctx.setLineDash([2, 3]);
                ctx.lineWidth = 0.5;
                
                const rayStartX = left; 
                const rayEndX = this.canvas.width - this.sidebarWidth;
                
                // Helper to draw labeled ray
                const drawLabeledRay = (y: number, label: string, color: string, isSL: boolean = false, leftLabel?: string, leftLabelColor?: string) => {
                    ctx.beginPath();
                    ctx.setLineDash([2, 3]);
                    ctx.lineWidth = isSL ? 1.5 : 0.5; // Thicker for SL as requested
                    ctx.strokeStyle = color;
                    ctx.moveTo(rayStartX, y);
                    ctx.lineTo(rayEndX, y);
                    ctx.stroke();

                    // Label Background & Text (Right side)
                    ctx.setLineDash([]); 
                    ctx.font = 'bold 10px Inter';
                    const textWidth = ctx.measureText(label).width;
                    const h = 14;
                    const wLabel = textWidth + 8;
                    
                    ctx.fillStyle = color;
                    // Draw label background at the end of the ray
                    this.roundRect(ctx, rayEndX - wLabel - 2, y - (h/2), wLabel, h, 3, true, false);
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(label, rayEndX - (wLabel/2) - 2, y);

                    // Left Label (RR label) - Moved OUTSIDE to the left, smaller
                    if (leftLabel) {
                        ctx.font = 'bold 8px Inter'; // Smaller font for RR
                        const lTextWidth = ctx.measureText(leftLabel).width;
                        const lh = 12; // Smaller height
                        const lw = lTextWidth + 6; // Smaller padding
                        ctx.fillStyle = leftLabelColor || color;
                        // Place outside at rayStartX - lw - 5
                        this.roundRect(ctx, rayStartX - lw - 5, y - (lh/2), lw, lh, 2, true, false);
                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(leftLabel, rayStartX - (lw/2) - 5, y);
                    }
                };

                const managedStopY = d.managedStopPrice !== undefined ? this.getYFromPrice(d.managedStopPrice) : stopY;

                // Dynamic SL Color Logic
                let slRayColor = lossColor;
                if (d.managedStopPrice !== undefined) {
                    const entryPrice = d.points[0].price;
                    const isLong = d.type === DrawingType.LONG_POSITION;
                    const isBreakeven = Math.abs(d.managedStopPrice - entryPrice) < 0.00000001;
                    
                    if (isBreakeven) {
                        slRayColor = '#3b82f6'; // Clean Blue for Breakeven
                    } else if (isLong) {
                        slRayColor = d.managedStopPrice > entryPrice ? '#00ff00' : '#ff0000';
                    } else {
                        slRayColor = d.managedStopPrice < entryPrice ? '#00ff00' : '#ff0000';
                    }
                }

                const riskValue = Math.abs(entry - stop);
                const currentStopPrice = d.managedStopPrice !== undefined ? d.managedStopPrice : stop;
                const currentStopRR = (Math.abs(currentStopPrice - entry) / (riskValue || 0.0001)).toFixed(2) + " RR";
                const targetRR = (Math.abs(target - entry) / (riskValue || 0.0001)).toFixed(2) + " RR";

                // Colors: SL -> Green, EN -> Blue, TP -> Green
                const rrGreen = '#4CAF50';
                const rrBlue = '#2196F3';

                drawLabeledRay(targetY, 'TP', profitColor, false, targetRR, rrGreen);
                drawLabeledRay(managedStopY, 'SL', slRayColor, true, currentStopRR, rrGreen);
                drawLabeledRay(entryY, 'EN', '#000000', false, "0.00 RR", rrBlue);

                // Special Draggable Handle for SL when selected & triggered
                if (isSelected) {
                    const handleX = right + 20; // Place handle outside the box to the right
                    ctx.fillStyle = '#ffffff';
                    ctx.strokeStyle = slRayColor;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(handleX, managedStopY, 5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    
                    // Icon inside handle to signify draggability
                    ctx.strokeStyle = slRayColor;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(handleX - 2, managedStopY - 2);
                    ctx.lineTo(handleX + 2, managedStopY - 2);
                    ctx.moveTo(handleX - 2, managedStopY);
                    ctx.lineTo(handleX + 2, managedStopY);
                    ctx.moveTo(handleX - 2, managedStopY + 2);
                    ctx.lineTo(handleX + 2, managedStopY + 2);
                    ctx.stroke();
                }

                ctx.restore();
            }

            // --- LABELS & HANDLES (Only visible when selected) ---
            if (isSelected && !(this.draggingPointIdx === 5 && this.selectedDrawingId === d.id)) {
                const qty = 4;
                const pDiff = Math.abs(target - entry);
                const lDiff = Math.abs(stop - entry);
                const rr = pDiff / (lDiff || 0.0001);
                
                const lastPrice = this.data[this.data.length - 1]?.close || entry;
                const pnlPrice = status === 'won' ? target : (status === 'lost' ? stop : lastPrice);
                const currentPnl = (isLong ? (pnlPrice - entry) : (entry - pnlPrice)) * qty * 1000;

                // Center Badge
                ctx.font = '500 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const badgeTitle = `${status === 'active' ? 'Position' : (status === 'won' ? 'Closed' : 'Stopped')} P&L: ${currentPnl.toFixed(1)}`;
                const badgeSub = `Risk/Reward Ratio: ${rr.toFixed(2)}`;
                const bw = Math.max(ctx.measureText(badgeTitle).width, ctx.measureText(badgeSub).width) + 30;
                const bh = 40;
                const bx = midX - bw/2;
                const by = entryY - bh/2;
                
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(0,0,0,0.4)';
                ctx.fillStyle = status === 'won' ? profitColor : (status === 'lost' ? lossColor : '#1e293bcc');
                this.roundRect(ctx, bx, by, bw, bh, 6, true, false);
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#ffffff';
                ctx.fillText(badgeTitle, midX, by + 13);
                ctx.fillText(badgeSub, midX, by + 27);

                // Tags
                const drawMetricTag = (price: number, diff: number, title: string, color: string, top: boolean) => {
                    const pct = ((diff / entry) * 100).toFixed(3);
                    const amt = (diff * qty * 1000).toFixed(1);
                    const ticks = (diff * 10).toFixed(0); 
                    const txt = `${title}: ${diff.toFixed(1)} (${pct}%) ${ticks}, Amount: ${amt}`;
                    ctx.font = '500 11px sans-serif';
                    const tw = ctx.measureText(txt).width + 20;
                    const th = 24;
                    const tx = midX - tw/2;
                    const ty = top ? getY(price) - th - 8 : getY(price) + 8;
                    ctx.fillStyle = color;
                    this.roundRect(ctx, tx, ty, tw, th, 4, true, false);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(txt, midX, ty + th/2);
                };

                if (isLong) {
                    drawMetricTag(target, pDiff, 'Target', profitColor, true);
                    drawMetricTag(stop, lDiff, 'Stop', lossColor, false);
                } else {
                    drawMetricTag(stop, lDiff, 'Stop', lossColor, true);
                    drawMetricTag(target, pDiff, 'Target', profitColor, false);
                }

                // Simplify entry handles: small white circles
                if (!isClosed) {
                    const hRadius = 4;
                    const hLeft = Math.min(left, right);
                    const hRight = Math.max(left, right);
                    const handles = [
                        { x: hLeft, y: entryY, idx: 0 },
                        { x: hRight, y: entryY, idx: 4 }
                    ];
                    ctx.setLineDash([]);
                    handles.forEach(h => {
                        ctx.fillStyle = '#ffffff';
                        ctx.strokeStyle = '#2962ff';
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        ctx.arc(h.x, h.y, hRadius, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    });
                }
            }
          }
          break;

        case DrawingType.PRICE_RANGE:
          if (coords.length >= 2) {
            const p1 = d.points[0].price;
            const p2 = d.points[1].price;
            const x1 = coords[0].x;
            const x2 = coords[1].x;
            const y1 = coords[0].y;
            const y2 = coords[1].y;
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            
            // Background highlight
            ctx.fillStyle = (d.settings.color || '#3b82f6') + '11';
            const rectX = Math.min(x1, x2);
            const rectY = Math.min(y1, y2);
            const rectW = Math.abs(x2 - x1);
            const rectH = Math.abs(y2 - y1);
            ctx.fillRect(rectX, rectY, rectW, rectH);

            // Boundary lines (Horizontal)
            ctx.setLineDash([2, 2]);
            ctx.strokeStyle = (d.settings.color || '#3b82f6') + '88';
            ctx.beginPath();
            ctx.moveTo(0, y1);
            ctx.lineTo(width, y1);
            ctx.moveTo(0, y2);
            ctx.lineTo(width, y2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Main connecting line at midX
            ctx.beginPath();
            ctx.strokeStyle = d.settings.color || '#3b82f6';
            ctx.lineWidth = d.settings.lineWidth || 1.5;
            ctx.moveTo(midX, y1);
            ctx.lineTo(midX, y2);
            ctx.stroke();
            
            const diff = p2 - p1;
            const pc = (diff / p1) * 100;
            const labelLines = [
              `${diff.toFixed(2)}`,
              `(${pc.toFixed(2)}%)`
            ];

            // Info Box
            ctx.font = 'bold 10px sans-serif';
            const boxPadding = 8;
            let maxW = 0;
            labelLines.forEach(l => maxW = Math.max(maxW, ctx.measureText(l).width));
            
            const boxW = maxW + boxPadding * 2;
            const boxH = (labelLines.length * 14) + boxPadding;
            const boxX = midX - boxW / 2;
            const boxY = midY - boxH / 2;

            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#ffffff';
            this.roundRect(ctx, boxX, boxY, boxW, boxH, 4, true, false);
            ctx.shadowBlur = 0;
            
            ctx.strokeStyle = d.settings.color || '#3b82f6';
            ctx.lineWidth = 1;
            this.roundRect(ctx, boxX, boxY, boxW, boxH, 4, false, true);

            ctx.fillStyle = diff >= 0 ? '#10b981' : '#ef4444'; 
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            labelLines.forEach((line, i) => {
              ctx.fillText(line, midX, boxY + boxPadding + 7 + (i * 14));
            });
          }
          break;

        case DrawingType.DATE_RANGE:
          if (coords.length >= 2) {
            const t1 = d.points[0].time;
            const t2 = d.points[1].time;
            const x1 = coords[0].x;
            const x2 = coords[1].x;
            const y1 = coords[0].y;
            const y2 = coords[1].y;
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            
            const start = Math.min(t1, t2);
            const end = Math.max(t1, t2);
            
            // Highlight area
            ctx.fillStyle = (d.settings.color || '#3b82f6') + '11';
            const rectX = Math.min(x1, x2);
            const rectW = Math.abs(x2 - x1);
            ctx.fillRect(rectX, 0, rectW, height);

            // Vertical boundary lines
            ctx.setLineDash([2, 2]);
            ctx.strokeStyle = (d.settings.color || '#3b82f6') + '88';
            ctx.beginPath();
            ctx.moveTo(x1, 0);
            ctx.lineTo(x1, height);
            ctx.moveTo(x2, 0);
            ctx.lineTo(x2, height);
            ctx.stroke();
            ctx.setLineDash([]);

            // Main connecting line at midY
            ctx.beginPath();
            ctx.strokeStyle = d.settings.color || '#3b82f6';
            ctx.lineWidth = d.settings.lineWidth || 1.5;
            ctx.moveTo(x1, midY);
            ctx.lineTo(x2, midY);
            ctx.stroke();

            // Stats calculation
            let bars = 0;
            let totalVolume = 0;
            for (const candle of this.data) {
                if (candle.time >= start && candle.time <= end) {
                    bars++;
                    totalVolume += candle.volume;
                }
            }

            // Duration calculation
            const diffSeconds = end - start;
            const days = Math.floor(diffSeconds / 86400);
            const hours = Math.floor((diffSeconds % 86400) / 3600);
            const mins = Math.floor((diffSeconds % 3600) / 60);
            
            let durationStr = '';
            if (days > 0) durationStr += `${days}d `;
            if (hours > 0 || days > 0) durationStr += `${hours}h `;
            durationStr += `${mins}m`;

            // Volume formatting
            let volStr = totalVolume.toString();
            if (totalVolume >= 1000000) volStr = (totalVolume/1000000).toFixed(2) + 'M';
            else if (totalVolume >= 1000) volStr = (totalVolume/1000).toFixed(2) + 'K';

            // Draw Info Box
            const labelLines = [
              `${bars} bars, ${durationStr}`,
              `Vol: ${volStr}`
            ];
            
            ctx.font = 'bold 10px sans-serif';
            const boxPadding = 8;
            let maxW = 0;
            labelLines.forEach(l => maxW = Math.max(maxW, ctx.measureText(l).width));
            
            const boxW = maxW + boxPadding * 2;
            const boxH = (labelLines.length * 14) + boxPadding;
            const boxX = midX - boxW / 2;
            const boxY = midY - boxH / 2;

            // Box shadow & background
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#ffffff';
            this.roundRect(ctx, boxX, boxY, boxW, boxH, 4, true, false);
            ctx.shadowBlur = 0;
            
            // Box border
            ctx.strokeStyle = d.settings.color || '#3b82f6';
            ctx.lineWidth = 1;
            this.roundRect(ctx, boxX, boxY, boxW, boxH, 4, false, true);

            // Text
            ctx.fillStyle = '#1e293b';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            labelLines.forEach((line, i) => {
              ctx.fillText(line, midX, boxY + boxPadding + 7 + (i * 14));
            });
          }
          break;

        case DrawingType.ARROW_MARKER:
          if (coords.length >= 2) {
            const fromX = coords[0].x;
            const fromY = coords[0].y;
            const toX = coords[1].x;
            const toY = coords[1].y;
            
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
            ctx.stroke();
            
            const headlen = 10;
            const angle = Math.atan2(toY - fromY, toX - fromX);
            ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(toX, toY);
            ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
          }
          break;
      }
    });
    ctx.setLineDash([]);
  }

  public setOnDrawingsChange(callback: (drawings: Drawing[]) => void) {
    this.onDrawingsChange = callback;
  }

  public setOnSelectDrawing(callback: (drawing: Drawing | null) => void) {
    this.onSelectDrawing = callback;
  }

  public setOnDrawingComplete(callback: () => void) {
    this.onDrawingComplete = callback;
  }

  private getHitInfo(x: number, y: number): { id: string; pointIdx: number } | null {
    if (this.data.length === 0) return null;
    const width = this.canvasWidth;
    const height = this.canvasHeight;

    const getX = (idx: number) => {
        const paddingRight = this.PADDING_RIGHT;
        return (width - paddingRight) - (this.data.length - 1 - idx - this.offsetX) * this.zoom;
    };

    let minPriceVisible = Infinity;
    let maxPriceVisible = -Infinity;
    
    const paddingRight = this.PADDING_RIGHT;
    const lastIdx = this.data.length - 1;
    const endIdx = Math.min(lastIdx, Math.ceil(lastIdx - this.offsetX + (paddingRight / this.zoom) + 10));
    const startIdx = Math.max(0, Math.floor(endIdx - (width / this.zoom) - 20));

    for (let i = startIdx; i <= endIdx; i++) {
        const d = this.data[i];
        if (d) {
            minPriceVisible = Math.min(minPriceVisible, d.low);
            maxPriceVisible = Math.max(maxPriceVisible, d.high);
        }
    }
    const rangeBuffer = (maxPriceVisible - minPriceVisible) * 0.1;
    const minP = minPriceVisible - rangeBuffer;
    const maxP = maxPriceVisible + rangeBuffer;
    const priceScale = (height * 0.8 * this.yScale) / (maxP - minP || 1);
    const getY = (price: number) => height * 0.9 + this.offsetY - (price - minP) * priceScale;
    
    const sortedDrawings = [...this.drawings].sort((a, b) => {
      if (a.id === this.selectedDrawingId) return -1;
      if (b.id === this.selectedDrawingId) return 1;
      return 0;
    });

    const lastCandle = this.data[this.data.length - 1];
    const firstCandle = this.data[0];
    const avgInterval = (this.data.length > 1 
      ? (lastCandle.time - firstCandle.time) / (this.data.length - 1) 
      : this.avgInterval) || 3600;

    const HIT_RADIUS = 7; // Improved precision for handles

    for (const d of sortedDrawings) {
        if (d.settings.hidden) continue;
        
        const getXFromTime = (time: number) => {
          const idx = (time - lastCandle.time) / avgInterval + (this.data.length - 1);
          return getX(idx) + this.zoom / 2;
        };

        const coords = d.points.map(p => {
          return {
            x: getXFromTime(p.time),
            y: getY(p.price)
          };
        });

        for (let i = 0; i < coords.length; i++) {
          if (d.type === DrawingType.LONG_POSITION || d.type === DrawingType.SHORT_POSITION) {
            const metrics = this.getPositionMetrics(d);
            // STRICT RULE: Closed positions cannot have their handles interacted with
            if (metrics.isClosed) continue;
          }
          const dist = Math.sqrt((coords[i].x - x)**2 + (coords[i].y - y)**2);
          if (dist < HIT_RADIUS) { 
            return { id: d.id, pointIdx: i };
          }
        }

        if (d.type === DrawingType.RECTANGLE && coords.length >= 2) {
          const dist2 = Math.sqrt((coords[0].x - x)**2 + (coords[1].y - y)**2);
          if (dist2 < HIT_RADIUS) return { id: d.id, pointIdx: 2 };
          
          const dist3 = Math.sqrt((coords[1].x - x)**2 + (coords[0].y - y)**2);
          if (dist3 < HIT_RADIUS) return { id: d.id, pointIdx: 3 };

          const dist4 = Math.sqrt((coords[0].x - x)**2 + ((coords[0].y + coords[1].y)/2 - y)**2);
          if (dist4 < HIT_RADIUS) return { id: d.id, pointIdx: 4 };

          const dist5 = Math.sqrt((coords[1].x - x)**2 + ((coords[0].y + coords[1].y)/2 - y)**2);
          if (dist5 < HIT_RADIUS) return { id: d.id, pointIdx: 5 };
        }

        // Special cases for infinite lines or rays 
        if (d.type === DrawingType.HORIZONTAL_LINE) {
          const distY = Math.abs(coords[0].y - y);
          if (distY < 10) return { id: d.id, pointIdx: -1 };
        } else if (d.type === DrawingType.HORIZONTAL_RAY) {
          const distY = Math.abs(coords[0].y - y);
          const isRightSide = x >= coords[0].x - 5;
          if (distY < 10 && isRightSide) return { id: d.id, pointIdx: -1 };
        } else if (d.type === DrawingType.VERTICAL_LINE) {
          const distX = Math.abs(coords[0].x - x);
          if (distX < 10) return { id: d.id, pointIdx: -1 };
        }

        if (d.type === DrawingType.FIB_RETRACEMENT) {
          if (coords.length >= 2) {
            const p1 = d.points[0];
            const p2 = d.points[1];
            const diff = p2.price - p1.price;
            const fibLevels = d.settings.levels || [
              { value: 0 }, { value: 0.236 }, { value: 0.382 }, { value: 0.5 }, { value: 0.618 }, { value: 0.786 }, { value: 1 }
            ];
            const left = Math.min(coords[0].x, coords[1].x);
            const right = Math.max(coords[0].x, coords[1].x);

            // Check each visible level line
            for (const lvl of fibLevels) {
              if (lvl.visible === false) continue;
              const yLine = getY(p1.price + diff * lvl.value);
              if (x >= left - 5 && x <= right + 5 && Math.abs(y - yLine) < 10) {
                return { id: d.id, pointIdx: -1 };
              }
            }

            // Check trendline
            const dx = coords[1].x - coords[0].x;
            const dy = coords[1].y - coords[0].y;
            const dist = Math.abs(dy * x - dx * y + coords[1].x * coords[0].y - coords[1].y * coords[0].x) / Math.sqrt(dx * dx + dy * dy);
            if (dist < 10 && x >= Math.min(coords[0].x, coords[1].x) && x <= Math.max(coords[0].x, coords[1].x)) {
              return { id: d.id, pointIdx: -1 };
            }
          }
        }

        // Check path hit (rudimentary distance to segment)
        if (d.type === DrawingType.LONG_POSITION || d.type === DrawingType.SHORT_POSITION) {
          if (coords.length >= 2) {
             const metrics = this.getPositionMetrics(d);
             const { isClosed, renderLeftTime, renderRightTime, entry, target, stop } = metrics;
             
             const entryY = getY(entry);
             const targetY = getY(target);
             const stopY = getY(stop);
             
             const left = getXFromTime(renderLeftTime);
             const right = getXFromTime(renderRightTime);
             const midX = (left + right) / 2;
             const w = Math.max(20, right - left);
             
             // Check for adjustment handles - ONLY if NOT closed
             if (!isClosed) {
               // 1. Check entry / side handles - PRIORITY
               const hLeft = Math.min(left, right);
               const hRight = Math.max(left, right);
               const handles = [
                 { x: hLeft, y: entryY, idx: 0 },
                 { x: hRight, y: entryY, idx: 4 },
                 { x: midX, y: entryY, idx: 10 } // Center is now distinctly idx 10
               ];

               for (const h of handles) {
                 const dist = Math.sqrt((h.x - x)**2 + (h.y - y)**2);
                 if (dist < 12) return { id: d.id, pointIdx: h.idx };
               }

               const rayEndX = this.canvas.width - this.sidebarWidth;
               const hitRangeEnd = Math.max(right + 5, rayEndX); 
               if (x >= left - 5 && x <= hitRangeEnd) {
                 if (Math.abs(y - targetY) < 10) return { id: d.id, pointIdx: 1 };
                 
                 if (metrics.hasTriggered && d.managedStopPrice !== undefined) {
                   const mStopY = getY(d.managedStopPrice);
                   const handleX = right + 20;
                   const distSquare = (handleX - x)**2 + (mStopY - y)**2;
                   if (distSquare < 144) return { id: d.id, pointIdx: 5 };
                 }

                 if (Math.abs(y - stopY) < 10) return { id: d.id, pointIdx: 2 };
                 
                 // Entry line vertical move only
                 if (Math.abs(y - entryY) < 10) return { id: d.id, pointIdx: 10 };
               }
             }

             // Box hit - allowed even if closed for selection/details
             const top = Math.min(targetY, stopY);
             const bottom = Math.max(targetY, stopY);
             
             if (x >= left - 10 && x <= left + w + 10 && y >= top - 10 && y <= bottom + 10) {
                const metrics = this.getPositionMetrics(d);
                
                // If it's closed, we explicitly forbid ANY modification logic 
                // but allow selection for the info card.
                if (metrics.isClosed) {
                   // Sync status just in case
                   if (d.status !== metrics.status) {
                     d.status = metrics.status;
                     d.statusAt = metrics.statusTime;
                     this.onDrawingsChange?.(this.drawings);
                   }
                   // Return -1 for selection, but pointermove will block dragging
                   return { id: d.id, pointIdx: -1 };
                }

                return { id: d.id, pointIdx: -1 };
             }
          }
        } else if (d.type === DrawingType.PRICE_RANGE) {
          if (coords.length >= 2) {
            const rx = Math.min(coords[0].x, coords[1].x);
            const ry = Math.min(coords[0].y, coords[1].y);
            const rw = Math.abs(coords[1].x - coords[0].x);
            const rh = Math.abs(coords[1].y - coords[0].y);
            if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
              return { id: d.id, pointIdx: -1 };
            }
          }
        } else if (d.type === DrawingType.DATE_RANGE) {
          if (coords.length >= 2) {
            const rx = Math.min(coords[0].x, coords[1].x);
            const rw = Math.abs(coords[1].x - coords[0].x);
            if (x >= rx && x <= rx + rw) {
              return { id: d.id, pointIdx: -1 };
            }
          }
        } else if (d.type === DrawingType.RECTANGLE) {
           if (coords.length >= 2) {
            const rx = Math.min(coords[0].x, coords[1].x);
            const ry = Math.min(coords[0].y, coords[1].y);
            const rw = Math.abs(coords[1].x - coords[0].x);
            const rh = Math.abs(coords[1].y - coords[0].y);
            
            // For precision: check if mouse is inside the rectangle area
            // We reduce the hit area significantly for unselected rectangles to avoid accidental triggers
            // If it's selected, we allow grabbing the whole middle
            const innerMargin = d.id === this.selectedDrawingId ? 0 : 5;
            const isInside = x >= rx + innerMargin && x <= rx + rw - innerMargin && y >= ry + innerMargin && y <= ry + rh - innerMargin;
            
            // Also check distance to edges for easier grabbing of unselected ones
            const onEdge = (Math.abs(x - rx) < 5 || Math.abs(x - (rx + rw)) < 5) && y >= ry && y <= ry + rh ||
                           (Math.abs(y - ry) < 5 || Math.abs(y - (ry + rh)) < 5) && x >= rx && x <= rx + rw;

            if (isInside || onEdge) {
              return { id: d.id, pointIdx: -1 };
            }
          }
        }

        // Skip segment hit test for types that shouldn't have diagonal hits
        if (d.type === DrawingType.RECTANGLE || d.type === DrawingType.FIB_RETRACEMENT || d.type === DrawingType.LONG_POSITION || d.type === DrawingType.SHORT_POSITION || d.type === DrawingType.PRICE_RANGE || d.type === DrawingType.DATE_RANGE) {
          continue;
        }

        if (coords.length >= 2) {
          for (let i = 0; i < coords.length - 1; i++) {
            const p1 = coords[i];
            const p2 = coords[i+1];
            const d2 = (p2.x - p1.x)**2 + (p2.y - p1.y)**2;
            if (d2 === 0) {
              const dist = Math.sqrt((x - p1.x)**2 + (y - p1.y)**2);
              if (dist < 20) return { id: d.id, pointIdx: -1 };
            } else {
              let t = ((x - p1.x) * (p2.x - p1.x) + (y - p1.y) * (p2.y - p1.y)) / d2;
              t = Math.max(0, Math.min(1, t));
              const dist = Math.sqrt((x - (p1.x + t * (p2.x - p1.x)))**2 + (y - (p1.y + t * (p2.y - p1.y)))**2);
              if (dist < 10) return { id: d.id, pointIdx: -1 }; // Hit body
            }
          }
        } else if (coords.length === 1 && (d.type === DrawingType.HORIZONTAL_LINE || d.type === DrawingType.VERTICAL_LINE || d.type === DrawingType.HORIZONTAL_RAY)) {
          // Special cases for infinite lines or rays with 1 point
          if (d.type === DrawingType.HORIZONTAL_LINE || d.type === DrawingType.HORIZONTAL_RAY) {
            const distY = Math.abs(coords[0].y - y);
            const isRay = d.type === DrawingType.HORIZONTAL_RAY;
            const isRightSide = x >= coords[0].x;
            if (distY < 15 && (!isRay || isRightSide)) return { id: d.id, pointIdx: -1 };
          } else if (d.type === DrawingType.VERTICAL_LINE) {
            const distX = Math.abs(coords[0].x - x);
            if (distX < 15) return { id: d.id, pointIdx: -1 };
          }
        }
      }
    return null;
  }

  public setOnLoadMore(callback: () => void) {
    this.onLoadMore = callback;
  }

  public setLoadingMore(loading: boolean) {
    this.isLoadingMore = loading;
  }

  public resize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    
    const oldWidth = this.lastWidth;
    const oldHeight = this.lastHeight;
    const isInitial = oldWidth === 0;

    // Set initial zoom ONLY if this is the very first time we have dimensions
    if (isInitial) {
      const targetCandles = width > 768 ? 160 : 80;
      this.zoom = Math.max(3, Math.min(20, width / targetCandles));
      this.offsetX = -(targetCandles * 0.1); 
    }

    // Capture the current right-most visible index offset BEFORE updating width
    // This allows us to anchor the view to the right side during rotation
    // Index at right padding boundary = lastIdx - offsetX
    // We want this value to stay identical.

    this.sidebarWidth = 40; 
    
    if (!isInitial && oldWidth > 0 && oldHeight > 0) {
        // Vertical adjustment to maintain the focal price relative to height
        this.offsetY = (this.offsetY * height) / oldHeight;

        // By keeping this.zoom and this.offsetX UNCHANGED:
        // 1. The candle width remains exactly the same as in portrait.
        // 2. The distance from the right edge to the latest candle remains the same.
        // 3. Widening the screen (landscape) naturally extends the view to the LEFT,
        //    revealing more history without forcing a zoom change.
        
        if (this.aimerPos) {
          const px = this.getPointCoords(this.aimerPos);
          this.aimerPx = { x: px.x, y: px.y };
          if (this.aimerPx.x < 0 || this.aimerPx.x > width - this.sidebarWidth || this.aimerPx.y < 0 || this.aimerPx.y > height) {
            const centerX = Math.max(20, (width - this.sidebarWidth) / 2);
            const centerY = Math.max(20, height / 2);
            this.aimerPx = { x: centerX, y: centerY };
            this.aimerPos = this.getValuesAtCoords(centerX, centerY);
          }
        }
    }

    this.lastWidth = width;
    this.lastHeight = height;
    this.needsRangeUpdate = true;
    
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
    
    // Explicitly update range for the new dimensions
    this.calculateVisibleRange(width, height);
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: boolean, stroke: boolean) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  public draw() {
    if (!this.canvas) return;
    const width = this.lastWidth;
    const height = this.lastHeight;
    if (width <= 0 || height <= 0) return;
    
    const ctx = this.ctx;
    ctx.setLineDash([]);
    this.indicatorLevels = []; // Clear for this frame

    // Background clear is critical
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = this.theme.bg;
    ctx.fillRect(0, 0, width, height);

    if (this.data.length === 0) return;

    if (this.needsRangeUpdate) {
      this.calculateVisibleRange(width, height);
    }

    // Coordinate System constants
    const paddingRight = this.PADDING_RIGHT; 
    
    const getX = (index: number) => {
        return width - paddingRight - (this.data.length - 1 - index) * this.zoom + (this.offsetX * this.zoom);
    };

    const minP = this.cachedMinP;
    const maxP = this.cachedMaxP;
    const priceScale = this.cachedPriceScale;
    const startIdx = this.cachedStartIdx;
    const endIdx = this.cachedEndIdx;
    const priceRange = Math.abs(maxP - minP) || 1;

    const getY = (price: number) => {
        const y = height * 0.9 - (price - minP) * priceScale + this.offsetY;
        return isNaN(y) ? 0 : y;
    };

    // Calculate price scale parameters once for both grid and sidebar
    const targetLabelCount = Math.max(2, Math.floor(height / 60));
    const rawStep = priceRange / targetLabelCount;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const magResChars = rawStep / mag;
    
    let priceStep: number;
    if (magResChars < 1.0) priceStep = 1 * mag;
    else if (magResChars < 2.0) priceStep = 2 * mag;
    else if (magResChars < 4.0) priceStep = 4 * mag;
    else if (magResChars < 7.0) priceStep = 5 * mag;
    else priceStep = 10 * mag;

    const precision = priceStep < 1 ? Math.max(2, Math.ceil(-Math.log10(priceStep))) : 2;

    const formatPrice = (p: number) => {
        return p.toLocaleString('en-US', {
            minimumFractionDigits: precision,
            maximumFractionDigits: precision
        });
    };

    const interval = this.data.length > 1 ? this.data[1].time - this.data[0].time : 3600;
    const isIntraday = interval < 86400;
    const lastIdx = this.data.length - 1;

    const topPrice = (height * 0.9 + this.offsetY - 0) / priceScale + minP;
    const bottomPrice = (height * 0.9 + this.offsetY - (height - 30)) / priceScale + minP;

    // Draw Grid Lines (aligned with labels)
    if (this.theme.showGrid !== false) {
      ctx.strokeStyle = this.theme.grid;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([]); // Regular grids are solid but very faint in TV

      // 1. Horizontal Price Grid
      const startP = Math.floor(Math.min(topPrice, bottomPrice) / priceStep) * priceStep;
      const endP = Math.ceil(Math.max(topPrice, bottomPrice) / priceStep) * priceStep;
      
      for (let p = startP; p <= endP + priceStep; p += priceStep) {
          const y = getY(p);
          if (y < 0 || y > height) continue;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width - this.sidebarWidth, y);
          ctx.stroke();
      }

      // 2. Vertical Time Grid
      const idealSpacing = 100;
      const indexStep = Math.max(1, Math.ceil(idealSpacing / this.zoom));
      const niceIndexStep = (() => {
          const mag = Math.pow(10, Math.floor(Math.log10(indexStep)));
          const res = indexStep / mag;
          if (res < 1.5) return 1 * mag;
          if (res < 3.5) return 2 * mag;
          if (res < 7.5) return 5 * mag;
          return 10 * mag;
      })();

      for (let i = startIdx; i <= endIdx; i++) {
          if (i % niceIndexStep === 0) {
              const x = getX(i) + this.zoom / 2;
              if (x < 0 || x > width - this.sidebarWidth) continue;
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, height);
              ctx.stroke();
          }
      }
    }

    // Check for infinite scroll trigger
    if (this.onLoadMore && !this.isLoadingMore && startIdx <= 5) {
        const firstCandleX = getX(0);
        if (firstCandleX > -20) {
            this.isLoadingMore = true;
            this.onLoadMore();
        }
    }

    // Price Scale calculations for sidebar labels
    // Reuse values from above

    // Pinned Confluence Text (Background)
    if (this.pinnedText) {
      ctx.save();
      const isMobile = width < 768;
      const isLandscape = width > height;
      
      // Responsive font size - made even smaller for subtler background feel
      let fontSize = isMobile ? (isLandscape ? 8 : 9) : 11;
      
      ctx.font = `bold ${fontSize}px "Inter", sans-serif`;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.25)'; // Further reduced opacity for true background feel
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      
      // Adjust vertical position to be below the symbol/price header (usually ~80-100px down)
      const horizontalMargin = isMobile ? 12 : 24;
      const textX = width - this.sidebarWidth - horizontalMargin;
      let textY = isMobile ? 60 : 90; // Moved down to avoid top-right info
      
      // Handle multi-line text (all confluences)
      const lines = this.pinnedText.split('\n');
      for (const line of lines) {
        ctx.fillText(line.toUpperCase(), textX, textY);
        textY += fontSize * 1.6; // Slightly more spacing for legibility
      }
      
      ctx.restore();
    }

    // Draw Candles
    for (let i = startIdx; i <= endIdx; i++) {
      const candle = this.data[i];
      const x = getX(i);
      if (x < -this.zoom || x > width - this.sidebarWidth) continue;

      const bodyWidth = this.zoom > 3 ? this.zoom - 2 : Math.max(1, this.zoom - 0.5);
      const isUp = candle.close >= candle.open;
      const bodyTop = getY(Math.max(candle.open, candle.close));
      const bodyBottom = getY(Math.min(candle.open, candle.close));
      const bodyHeight = Math.max(1, bodyBottom - bodyTop);

      // Wick (thin out at high compression)
      ctx.strokeStyle = isUp ? this.theme.upWick : this.theme.downWick;
      ctx.lineWidth = this.zoom > 1 ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x + this.zoom / 2, getY(candle.high));
      ctx.lineTo(x + this.zoom / 2, getY(candle.low));
      ctx.stroke();

      // Body
      ctx.fillStyle = isUp ? this.theme.upColor : this.theme.downColor;
      if (this.zoom > 1.5) {
        ctx.strokeStyle = isUp ? this.theme.upBorder : this.theme.downBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + (this.zoom - bodyWidth) / 2, bodyTop, bodyWidth, bodyHeight);
      }
      ctx.fillRect(x + (this.zoom - bodyWidth) / 2, bodyTop, bodyWidth, bodyHeight);
    }

    // Indicators
    this.renderIndicators(ctx, startIdx, endIdx, getX, getY);

    // Render Drawings
    this.renderDrawings(ctx, width, height, getX, getY, minP, priceScale);

    // X-Axis Labels (Adaptive Date/Time Labeling)
    ctx.fillStyle = this.theme.text;
    ctx.font = '8.5px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    
    // Calculate how many indices to skip between labels to avoid overlap
    // Aim for ~100px between labels
    const idealSpacing = 100;
    const indexStep = Math.max(1, Math.ceil(idealSpacing / this.zoom));
    
    // Find a "nice" step (1, 2, 5, 10, 20, 50, 100...)
    const niceIndexStep = (() => {
        const mag = Math.pow(10, Math.floor(Math.log10(indexStep)));
        const res = indexStep / mag;
        if (res < 1.5) return 1 * mag;
        if (res < 3.5) return 2 * mag;
        if (res < 7.5) return 5 * mag;
        return 10 * mag;
    })();

    for (let i = startIdx; i <= endIdx; i++) {
        // Only draw labels at nice index positions
        if (i % niceIndexStep === 0) {
            const candle = this.data[i];
            const x = getX(i);
            if (x < 0 || x > width - this.sidebarWidth) continue;

            let label = '';
            
            const prevCandle = i > 0 ? this.data[i-1] : null;

            if (isIntraday) {
                const dateStrCurrent = this.formatDate(candle.time, { day: 'numeric' });
                const dateStrPrev = prevCandle ? this.formatDate(prevCandle.time, { day: 'numeric' }) : null;
                const isNewDay = !dateStrPrev || dateStrPrev !== dateStrCurrent;

                if (isNewDay) {
                    // Show Month Name and Day Date
                    label = this.formatDate(candle.time, { day: 'numeric', month: 'short' });
                } else {
                    // Show HH:mm
                    label = this.formatDate(candle.time, { hour: '2-digit', minute: '2-digit' });
                }
            } else {
                const yearCurrent = this.formatDate(candle.time, { year: 'numeric' });
                const yearPrev = prevCandle ? this.formatDate(prevCandle.time, { year: 'numeric' }) : null;
                const isNewYear = !yearPrev || yearPrev !== yearCurrent;

                const monthCurrent = this.formatDate(candle.time, { month: 'short' });
                const monthPrev = prevCandle ? this.formatDate(prevCandle.time, { month: 'short' }) : null;
                const isNewMonth = !monthPrev || monthPrev !== monthCurrent;

                if (isNewYear) {
                    label = yearCurrent;
                } else if (isNewMonth) {
                    label = monthCurrent;
                } else {
                    label = this.formatDate(candle.time, { day: 'numeric' });
                }
            }
            
            ctx.fillText(label, x + this.zoom / 2, height - 6);
        }
    }

    // --- Unified Price Label System ---
    const sidebarLabels: Array<{
        y: number;
        text: string;
        bgColor?: string;
        textColor: string;
        priority: number;
        isMain?: boolean;
    }> = [];

    // 1. Collect standard axis labels
    const startP = Math.floor(Math.min(topPrice, bottomPrice) / priceStep) * priceStep;
    const endP = Math.ceil(Math.max(topPrice, bottomPrice) / priceStep) * priceStep;
    for (let p = startP; p <= endP; p += priceStep) {
        const y = getY(p);
        if (y < 0 || y > height - 30) continue; 
        sidebarLabels.push({
            y,
            text: formatPrice(p),
            textColor: "#94a3b8",
            priority: 10
        });
    }

    // 2. Collect Drawings Tags
    this.drawings.forEach(d => {
        if (d.settings.hidden) return;
        if (d.status === 'won' || d.status === 'lost') return; // Hide sidebar tags for closed trades
        
        // Only show price tags for specific types as requested:
        // (long and short position, horizontal ray, horizontal line)
        const showPriceTag = 
          d.type === DrawingType.HORIZONTAL_LINE || 
          d.type === DrawingType.HORIZONTAL_RAY || 
          d.type === DrawingType.LONG_POSITION || 
          d.type === DrawingType.SHORT_POSITION;
        
        if (!showPriceTag) return;

        d.points.forEach((p, idx) => {
            // For horizontal types, only show one tag (for first point)
            if ((d.type === DrawingType.HORIZONTAL_LINE || d.type === DrawingType.HORIZONTAL_RAY) && idx > 0) return;
            
            const py = getY(p.price);
            if (py < 0 || py > height - 30) return;
            
            let tagColor = d.settings.color || '#2962ff';
            if (d.type === DrawingType.LONG_POSITION || d.type === DrawingType.SHORT_POSITION) {
              if (idx === 0) tagColor = '#1e222d';
              if (idx === 1) tagColor = d.settings.profitColor || '#089981';
              if (idx === 2) tagColor = d.settings.lossColor || '#f23645';
            }
            
            sidebarLabels.push({
                y: py,
                text: formatPrice(p.price),
                bgColor: tagColor,
                textColor: '#ffffff',
                priority: 20
            });
        });
    });

    // 3. Collect Indicator Tags
    this.indicatorLevels.forEach(lvl => {
        const py = getY(lvl.price);
        if (py < 0 || py > height - 30) return;
        sidebarLabels.push({
            y: py,
            text: formatPrice(lvl.price),
            bgColor: lvl.color,
            textColor: '#ffffff',
            priority: 30
        });
    });

    // 4. Collect Crosshair/Aimer
    if (this.isCrosshairActive && !this.isDrawingToolEnabled && this.mouseX >= 0 && this.mouseY >= 0 && this.mouseX < width - this.sidebarWidth) {
        const crossPrice = (height * 0.9 + this.offsetY - this.mouseY) / priceScale + minP;
        sidebarLabels.push({
            y: this.mouseY,
            text: formatPrice(crossPrice),
            bgColor: '#1e222d',
            textColor: '#ffffff',
            priority: 45
        });

        // Draw crosshair lines
        ctx.strokeStyle = this.theme.text + "88";
        ctx.lineWidth = 1.0;
        ctx.setLineDash([3, 3]);
        
        ctx.beginPath();
        ctx.moveTo(this.mouseX, 0);
        ctx.lineTo(this.mouseX, height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, this.mouseY);
        ctx.lineTo(width - this.sidebarWidth, this.mouseY);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if (this.isDrawingToolEnabled && this.aimerPx && this.aimerPos) {
        sidebarLabels.push({
            y: this.aimerPx.y,
            text: formatPrice(this.aimerPos.price),
            bgColor: '#131722',
            textColor: '#ffffff',
            priority: 40
        });
    }

    // 5. Collect Current Price (Highest Priority)
    const lastCandle = this.data[this.data.length - 1];

    let currentPriceY = -1;
    if (lastCandle) {
        currentPriceY = getY(lastCandle.close);
        if (currentPriceY >= 0 && currentPriceY <= height - 30) {
            sidebarLabels.push({
                y: currentPriceY,
                text: formatPrice(lastCandle.close),
                bgColor: '#2962ff', // Professional blue for current price
                textColor: '#ffffff',
                priority: 50,
                isMain: true
            });
        }
    }

    // --- Draw Sidebar Base ---
    ctx.fillStyle = this.theme.bg;
    ctx.fillRect(width - this.sidebarWidth, 0, this.sidebarWidth, height);
    ctx.fillRect(width - this.sidebarWidth, height - 30, this.sidebarWidth, 30);

    // --- Price Line for Current Price ---
    if (currentPriceY >= 0 && currentPriceY <= height - 30) {
        ctx.strokeStyle = this.theme.text + "44"; // Faint line
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(0, currentPriceY);
        ctx.lineTo(width - this.sidebarWidth, currentPriceY);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // --- Collision and Rendering ---
    // Sort by priority DESC so we place important ones first
    const sortedLabels = sidebarLabels.sort((a, b) => b.priority - a.priority);
    const occupiedRanges: Array<{ min: number, max: number }> = [];
    const labelHeight = 18;

    sortedLabels.forEach(lbl => {
        let y = lbl.y;
        
        // Check for collisions
        let hasCollision = false;
        // Priority stacking logic: If priority > 20, we can shift slightly. 
        // If it's an axis label (priority 10), we just hide if it collides.
        
        const checkOverlap = (testY: number) => {
            return occupiedRanges.some(r => testY + labelHeight/2 > r.min && testY - labelHeight/2 < r.max);
        };

        if (lbl.priority <= 10) {
            if (checkOverlap(y)) return; // Discard axis label if blocked
        } else {
            // Priority label: try to find a spot nearby if blocked
            let shift = 0;
            const maxShift = 40;
            while (checkOverlap(y + shift) && Math.abs(shift) < maxShift) {
                // Alternating shift
                shift = shift >= 0 ? -(shift + 2) : -shift;
            }
            if (checkOverlap(y + shift)) return; // Still blocked, or moved too far
            y += shift;
        }

        // Add to occupied
        occupiedRanges.push({ min: y - labelHeight / 2 - 1, max: y + labelHeight / 2 + 1 });

        // Draw it
        const tagX = width - this.sidebarWidth;
        const tagW = this.sidebarWidth;
        const tagY = y - labelHeight / 2;

        if (lbl.bgColor) {
            // Draw background with subtle shadow or border for depth
            ctx.fillStyle = lbl.bgColor;
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(tagX, tagY, tagW, labelHeight, 2);
                ctx.fill();
                
                // Add a very faint white top border for depth if it's a main label
                if (lbl.priority >= 40) {
                    ctx.strokeStyle = "rgba(255,255,255,0.2)";
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(tagX, tagY);
                    ctx.lineTo(tagX + tagW, tagY);
                    ctx.stroke();
                }
            } else {
                ctx.fillRect(tagX, tagY, tagW, labelHeight);
            }
        }

        ctx.fillStyle = lbl.textColor;
        ctx.font = lbl.priority >= 40 ? 'bold 10px "Inter", sans-serif' : '9px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(lbl.text, tagX + tagW / 2, y);
    });

    // --- Time Labels (Bottom Gutter) ---
    ctx.fillStyle = this.theme.bg;
    ctx.fillRect(0, height - 30, width, 30);
    ctx.strokeStyle = this.theme.text + "22";
    ctx.beginPath();
    ctx.moveTo(0, height - 30);
    ctx.lineTo(width, height - 30);
    ctx.stroke();

    // Time Tags for Crosshair and Aimer
    const drawTimeTag = (x: number) => {
        const hoverIdx = Math.floor(lastIdx - this.offsetX + (x - (width - paddingRight)) / this.zoom);
        if (hoverIdx >= 0 && hoverIdx < this.data.length) {
            const hoverCandle = this.data[hoverIdx];
            const timeStr = this.formatDate(hoverCandle.time, { 
              day: 'numeric', 
              month: 'short', 
              year: isIntraday ? undefined : 'numeric',
              hour: isIntraday ? '2-digit' : undefined, 
              minute: isIntraday ? '2-digit' : undefined,
              hour12: false 
            });
            
            ctx.font = 'bold 9px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const textWidth = ctx.measureText(timeStr).width;
            const tagW = textWidth + 12;
            const tagH = 18;
            
            ctx.fillStyle = '#1e222d';
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(x - tagW / 2, height - 15 - tagH / 2, tagW, tagH, 3);
                ctx.fill();
            } else {
                ctx.fillRect(x - tagW / 2, height - 15 - tagH / 2, tagW, tagH);
            }
            
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(timeStr, x, height - 15);
        }
    };

    if (this.isCrosshairActive && !this.isDrawingToolEnabled && this.mouseX >= 0 && this.mouseX < width - this.sidebarWidth) {
        drawTimeTag(this.mouseX);
    }
    if (this.isDrawingToolEnabled && this.aimerPx) {
        drawTimeTag(this.aimerPx.x);
    }


    // --- Render Precision Aimer (TradingView Mobile Style) ---
    if (this.isDrawingToolEnabled && this.aimerPx && this.aimerPos) {
      const ax = this.aimerPx.x;
      const ay = this.aimerPx.y;

      // 1. Connection Line (Dotted line from last fixed point to aimer)
      if (this.activeDrawing && this.activeDrawing.points.length > 0) {
        const lastFixedIdx = this.activeDrawing.type === DrawingType.PATH 
          ? Math.max(0, this.activeDrawing.points.length - 2)
          : 0;
        const lastPoint = this.activeDrawing.points[lastFixedIdx];
        if (lastPoint) {
            const lastCoords = this.getPointCoords(lastPoint);
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = '#64748b99';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(lastCoords.x, lastCoords.y);
            ctx.lineTo(ax, ay);
            ctx.stroke();
        }
      }

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#64748b'; // Gray for Aimer
      ctx.lineWidth = 1;
      
      // Horizontal Aimer Line
      ctx.beginPath();
      ctx.moveTo(0, ay);
      ctx.lineTo(width - this.sidebarWidth, ay);
      ctx.stroke();
      
      // Vertical Aimer Line
      ctx.beginPath();
      ctx.moveTo(ax, 0);
      ctx.lineTo(ax, height);
      ctx.stroke();
      
      ctx.setLineDash([]);
      
      // Labels (Price and Time)
      ctx.font = 'bold 8px "Inter", sans-serif';
      
      // Price tag
      const priceText = formatPrice(this.aimerPos.price);
      ctx.fillStyle = '#131722'; 
      const tH = 18;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(width - this.sidebarWidth, ay - tH / 2, this.sidebarWidth, tH, 3);
        ctx.fill();
      } else {
        ctx.fillRect(width - this.sidebarWidth, ay - tH / 2, this.sidebarWidth, tH);
      }
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(priceText, width - this.sidebarWidth / 2, ay);

      // Time tag
      const aimIdx = Math.round(lastIdx - this.offsetX + (ax - (width - paddingRight)) / this.zoom);
      if (aimIdx >= 0 && aimIdx < this.data.length) {
          const aimCandle = this.data[aimIdx];
          const timeStr = this.formatDate(aimCandle.time, { 
            day: 'numeric', month: 'short', year: isIntraday ? undefined : 'numeric',
            hour: isIntraday ? '2-digit' : undefined, minute: isIntraday ? '2-digit' : undefined,
            hour12: false 
          });
          
          const textWidth = ctx.measureText(timeStr).width;
          ctx.fillStyle = '#131722';
          ctx.fillRect(ax - (textWidth + 10) / 2, height - 15, textWidth + 10, 15);
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(timeStr, ax, height - 2);
      }
    }
  }

}
