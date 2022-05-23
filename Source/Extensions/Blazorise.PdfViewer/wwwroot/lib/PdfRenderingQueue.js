import { RenderingStates } from "./base.js";

const CLEANUP_TIMEOUT = 30000;

export class PdfRenderingQueue {
    constructor() {
        this.pdfViewer = null;
        this.pdfThumbnailViewer = null;
        this.onIdle = null;
        this.highestPriorityPage = null;
        this.idleTimeout = null;
        this.printing = false;
        this.isThumbnailViewEnabled = false;
    }

    setViewer(pdfViewer) {
        this.pdfViewer = pdfViewer;
    }

    setThumbnailViewer(pdfThumbnailViewer) {
        this.pdfThumbnailViewer = pdfThumbnailViewer;
    }

    isHighestPriority(view) {
        return this.highestPriorityPage === view.renderingId;
    }

    hasViewer() {
        return !!this.pdfViewer;
    }

    renderHighestPriority(currentlyVisiblePages) {
        if (this.idleTimeout) {
            clearTimeout(this.idleTimeout);
            this.idleTimeout = null;
        }

        // Pages have a higher priority than thumbnails, so check them first.
        if (this.pdfViewer.forceRendering(currentlyVisiblePages)) {
            return;
        }

        // No pages needed rendering, so check thumbnails.
        if (this.isThumbnailViewEnabled && this.pdfThumbnailViewer?.forceRendering()) {
            return;
        }

        if (this.printing) {
            // If printing is currently ongoing do not reschedule cleanup.
            return;
        }

        if (this.onIdle) {
            this.idleTimeout = setTimeout(this.onIdle.bind(this), CLEANUP_TIMEOUT);
        }
    }

    getHighestPriority(visible, views, scrolledDown, preRenderExtra = false) {
        /**
         * The state has changed. Figure out which page has the highest priority to
         * render next (if any).
         *
         * Priority:
         * 1. visible pages
         * 2. if last scrolled down, the page after the visible pages, or
         *    if last scrolled up, the page before the visible pages
         */
        const visibleViews = visible.views,
            numVisible = visibleViews.length;

        if (numVisible === 0) {
            return null;
        }
        for (let i = 0; i < numVisible; i++) {
            const view = visibleViews[i].view;
            if (!this.isViewFinished(view)) {
                return view;
            }
        }
        const firstId = visible.first.id,
            lastId = visible.last.id;

        // All the visible views have rendered; try to handle any "holes" in the
        // page layout (can happen e.g. with spreadModes at higher zoom levels).
        if (lastId - firstId + 1 > numVisible) {
            const visibleIds = visible.ids;
            for (let i = 1, ii = lastId - firstId; i < ii; i++) {
                const holeId = scrolledDown ? firstId + i : lastId - i;
                if (visibleIds.has(holeId)) {
                    continue;
                }
                const holeView = views[holeId - 1];
                if (!this.isViewFinished(holeView)) {
                    return holeView;
                }
            }
        }

        // All the visible views have rendered; try to render next/previous page.
        // (IDs start at 1, so no need to add 1 when `scrolledDown === true`.)
        let preRenderIndex = scrolledDown ? lastId : firstId - 2;
        let preRenderView = views[preRenderIndex];

        if (preRenderView && !this.isViewFinished(preRenderView)) {
            return preRenderView;
        }
        if (preRenderExtra) {
            preRenderIndex += scrolledDown ? 1 : -1;
            preRenderView = views[preRenderIndex];

            if (preRenderView && !this.isViewFinished(preRenderView)) {
                return preRenderView;
            }
        }
        // Everything that needs to be rendered has been.
        return null;
    }

    isViewFinished(view) {
        return view.renderingState === RenderingStates.FINISHED;
    }

    renderView(view) {
        switch (view.renderingState) {
            case RenderingStates.FINISHED:
                return false;
            case RenderingStates.PAUSED:
                this.highestPriorityPage = view.renderingId;
                view.resume();
                break;
            case RenderingStates.RUNNING:
                this.highestPriorityPage = view.renderingId;
                break;
            case RenderingStates.INITIAL:
                this.highestPriorityPage = view.renderingId;
                view
                    .draw()
                    .finally(() => {
                        this.renderHighestPriority();
                    })
                    .catch(reason => {
                        if (reason instanceof pdfjsLib.RenderingCancelledException) {
                            return;
                        }
                        console.error(`renderView: "${reason}"`);
                    });
                break;
        }
        return true;
    }
}