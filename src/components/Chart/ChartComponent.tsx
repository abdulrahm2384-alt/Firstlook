/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { ChartEngine } from './ChartEngine';
import { Candle, Trade, ChartTheme, IndicatorInstance } from '../../types';
import { Drawing, DrawingType, DrawingPoint } from '../../types/drawing';

interface ChartProps {
  data: Candle[];
  trades: Trade[];
  symbol: string;
  theme?: ChartTheme;
  indicators?: IndicatorInstance[];
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  drawingTool?: DrawingType | null;
  drawings?: Drawing[];
  selectedId?: string | null;
  drawingSettings?: any;
  onDrawingsChange?: (drawings: Drawing[]) => void;
  onSelectDrawing?: (drawing: Drawing | null) => void;
  onDrawingComplete?: () => void;
  onDrawingSettingsChange?: (settings: any) => void;
  viewport?: { zoom: number, offsetX: number, offsetY: number, yScale: number };
  onViewportChange?: (viewport: { zoom: number, offsetX: number, offsetY: number, yScale: number }) => void;
  onTradeClosed?: (trade: any) => void;
  onDrawingTrigger?: (drawing: Drawing) => void;
  timeframe?: string;
  isReplay?: boolean;
  isSimulating?: boolean;
  prefix?: string;
  pinnedText?: string | null;
}

export const ChartComponent = forwardRef<ChartEngine | null, ChartProps>(({ 
  data, 
  trades, 
  symbol,
  theme, 
  indicators = [],
  onLoadMore, 
  isLoadingMore,
  drawingTool = null,
  drawings = [],
  selectedId = null,
  drawingSettings,
  onDrawingsChange,
  onSelectDrawing,
  onDrawingComplete,
  onDrawingSettingsChange,
  viewport,
  onViewportChange,
  onTradeClosed,
  onDrawingTrigger,
  timeframe,
  isReplay = false,
  isSimulating = false,
  prefix,
  pinnedText
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ChartEngine | null>(null);

  useImperativeHandle(ref, () => engineRef.current as ChartEngine);

  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new ChartEngine(canvasRef.current);
    }
  }, []);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSymbol(symbol);
    }
  }, [symbol]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setPrefix(prefix || null);
    }
  }, [prefix]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setIsReplay(!!isReplay);
    }
  }, [isReplay]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setIsSimulating(!!isSimulating);
    }
  }, [isSimulating]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setData(data, trades);
    }
  }, [data, trades]);

  useEffect(() => {
    if (engineRef.current && timeframe) {
      engineRef.current.setTimeframe(timeframe);
    }
  }, [timeframe]);

  useEffect(() => {
    if (engineRef.current && theme) {
      engineRef.current.setTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    if (engineRef.current && onLoadMore) {
      engineRef.current.setOnLoadMore(onLoadMore);
    }
  }, [onLoadMore]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setLoadingMore(!!isLoadingMore);
    }
  }, [isLoadingMore]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setDrawingTool(drawingTool);
    }
  }, [drawingTool]);

  useEffect(() => {
    if (engineRef.current) {
      if (onDrawingsChange) engineRef.current.setOnDrawingsChange(onDrawingsChange);
      if (onSelectDrawing) engineRef.current.setOnSelectDrawing(onSelectDrawing);
      if (onDrawingComplete) engineRef.current.setOnDrawingComplete(onDrawingComplete);
      if (onDrawingSettingsChange) engineRef.current.setOnDrawingSettingsChange(onDrawingSettingsChange);
    }
  }, [onDrawingsChange, onSelectDrawing, onDrawingComplete, onDrawingSettingsChange]);

  useEffect(() => {
    if (engineRef.current && drawingSettings) {
      engineRef.current.setDrawingSettings(drawingSettings);
    }
  }, [drawingSettings]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setDrawings(drawings || []);
    }
  }, [drawings]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setIndicators(indicators);
    }
  }, [indicators]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSelectedDrawingId(selectedId || null);
    }
  }, [selectedId]);

  useEffect(() => {
    if (engineRef.current && onViewportChange) {
      engineRef.current.setOnViewportChange(onViewportChange);
    }
  }, [onViewportChange]);

  useEffect(() => {
    if (engineRef.current && onTradeClosed) {
      engineRef.current.setOnTradeClosed(onTradeClosed);
    }
  }, [onTradeClosed]);

  useEffect(() => {
    if (engineRef.current && onDrawingTrigger) {
      engineRef.current.setOnDrawingTrigger(onDrawingTrigger);
    }
  }, [onDrawingTrigger]);

  useEffect(() => {
    if (engineRef.current) {
      if (viewport) {
        const current = engineRef.current.getViewport();
        // Only set if different to avoid noise
        if (
          current.zoom !== viewport.zoom ||
          current.offsetX !== viewport.offsetX ||
          current.offsetY !== viewport.offsetY ||
          current.yScale !== viewport.yScale
        ) {
          engineRef.current.setViewport(viewport.zoom, viewport.offsetX, viewport.offsetY, viewport.yScale);
        }
      } else {
        engineRef.current.resetView();
      }
    }
  }, [viewport]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setPinnedText(pinnedText || null);
    }
  }, [pinnedText]);

  useEffect(() => {
    if (!containerRef.current || !engineRef.current) return;

    const resize = () => {
      if (!containerRef.current || !engineRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        engineRef.current.resize(rect.width, rect.height);
      }
    };

    const observer = new ResizeObserver((entries) => {
      // Use requestAnimationFrame to avoid "ResizeObserver loop limit exceeded"
      window.requestAnimationFrame(() => {
        if (!Array.isArray(entries) || !entries.length) return;
        for (const entry of entries) {
          if (entry.target === containerRef.current && engineRef.current) {
            const { width, height } = entry.contentRect;
            // Only resize if we have actual dimensions
            if (width > 0 && height > 0) {
              engineRef.current.resize(width, height);
            }
          }
        }
      });
    });

    observer.observe(containerRef.current);
    
    // Initial size with a fallback for slow layout updates on mobile
    resize();
    const timer1 = setTimeout(resize, 100);
    const timer2 = setTimeout(resize, 500); // Second check for mobile orientation shifts

    // Fallback for some mobile browsers
    window.addEventListener('orientationchange', resize);
    window.addEventListener('resize', resize);

    return () => {
      observer.disconnect();
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('orientationchange', resize);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden flex-1" style={{ backgroundColor: theme?.bg || '#ffffff' }}>
      <canvas ref={canvasRef} className="block w-full h-full touch-none" />
    </div>
  );
});
