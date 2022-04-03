import Module from '../../core/Module.js';

class ResizeColumns extends Module{
	
	constructor(table){
		super(table);
		
		this.startColumn = false;
		this.startX = false;
		this.startWidth = false;
		this.handle = null;
		this.prevHandle = null;
		
		this.initialized = false;
		
		this.registerColumnOption("resizable", true);
	}
	
	initialize(){
		this.subscribe("column-rendered", this.layoutColumnHeader.bind(this));
	}
	
	initializeEventWatchers(){
		if(!this.initialized){
			
			this.subscribe("cell-rendered", this.layoutCellHandles.bind(this));
			this.subscribe("cell-delete", this.deInitializeComponent.bind(this));
			
			this.subscribe("cell-height", this.resizeHandle.bind(this));
			this.subscribe("column-moved", this.columnLayoutUpdated.bind(this));
			
			this.subscribe("column-hide", this.deInitializeColumn.bind(this));
			this.subscribe("column-show", this.columnLayoutUpdated.bind(this));
			
			this.subscribe("column-delete", this.deInitializeComponent.bind(this));
			this.subscribe("column-height", this.resizeHandle.bind(this));
			
			this.initialized = true;
		}
	}
	
	
	layoutCellHandles(cell){
		if(cell.row.type === "row"){
			this.deInitializeComponent(cell);
			this.initializeColumn("cell", cell, cell.column, cell.element);
		}
	}
	
	layoutColumnHeader(column){
		if(column.definition.resizable){
			this.initializeEventWatchers();
			this.deInitializeComponent(column);
			this.initializeColumn("header", column, column, column.element);
		}
	}
	
	columnLayoutUpdated(column){
		var prev = column.prevColumn();
		
		this.reinitializeColumn(column);
		
		if(prev){
			this.reinitializeColumn(prev);
		}
	}
	
	reinitializeColumn(column){
		column.cells.forEach((cell) => {
			if(cell.modules.resize && cell.modules.resize.handleEl){
				cell.element.after(cell.modules.resize.handleEl);
			}
		});
		
		if(column.modules.resize && column.modules.resize.handleEl){
			column.element.after(column.modules.resize.handleEl);
		}
	}
	
	initializeColumn(type, component, column, element){
		var self = this,
		variableHeight = false,
		mode = column.definition.resizable,
		config = {},
		nearestColumn = column.getLastColumn();
		
		//set column resize mode
		if(type === "header"){
			variableHeight = column.definition.formatter == "textarea" || column.definition.variableHeight;
			config = {variableHeight:variableHeight};
		}
		
		if((mode === true || mode == type) && this._checkResizability(nearestColumn)){
			
			var handle = document.createElement('div');
			handle.className = "tabulator-col-resize-handle";
			
			// var prevHandle = document.createElement('div');
			// prevHandle.className = "tabulator-col-resize-handle prev";
			
			handle.addEventListener("click", function(e){
				e.stopPropagation();
			});
			
			var handleDown = function(e){
				self.startColumn = column;
				self._mouseDown(e, nearestColumn, handle);
			};
			
			handle.addEventListener("mousedown", handleDown);
			handle.addEventListener("touchstart", handleDown, {passive: true});
			
			//resize column on  double click
			handle.addEventListener("dblclick", (e) => {
				var oldWidth = nearestColumn.getWidth();
				
				e.stopPropagation();
				nearestColumn.reinitializeWidth(true);
				
				if(oldWidth !== nearestColumn.getWidth()){
					self.dispatch("column-resized", nearestColumn);
					self.table.externalEvents.dispatch("columnResized", nearestColumn.getComponent());
				}
			});
			
			config.handleEl = handle;
			
			if(element.parentNode){
				element.after(handle);
			}
		}
		
		component.modules.resize = config;
	}
	
	deInitializeColumn(column){
		this.deInitializeComponent(column);
		
		column.cells.forEach((cell) => {
			this.deInitializeComponent(cell);
		});
	}
	
	deInitializeComponent(component){
		var handleEl;
		
		if(component.modules.resize){
			handleEl = component.modules.resize.handleEl;
			
			if(handleEl && handleEl.parentElement){
				handleEl.parentElement.removeChild(handleEl);
			}
		}
	}
	
	resizeHandle(component, height){
		if(component.modules.resize && component.modules.resize.handleEl){
			component.modules.resize.handleEl.style.height = height;
		}
	}
	
	_checkResizability(column){
		return column.definition.resizable;
	}
	
	_mouseDown(e, column, handle){
		var self = this;
		
		self.table.element.classList.add("tabulator-block-select");
		
		function mouseMove(e){
			// self.table.columnManager.tempScrollBlock();
			
			if(self.table.rtl){
				column.setWidth(self.startWidth - ((typeof e.screenX === "undefined" ? e.touches[0].screenX : e.screenX) - self.startX));
			}else{
				column.setWidth(self.startWidth + ((typeof e.screenX === "undefined" ? e.touches[0].screenX : e.screenX) - self.startX));
			}
			
			self.table.columnManager.renderer.rerenderColumns(true);
			
			if(!self.table.browserSlow && column.modules.resize && column.modules.resize.variableHeight){
				column.checkCellHeights();
			}
		}
		
		function mouseUp(e){
			
			//block editor from taking action while resizing is taking place
			if(self.startColumn.modules.edit){
				self.startColumn.modules.edit.blocked = false;
			}
			
			if(self.table.browserSlow && column.modules.resize && column.modules.resize.variableHeight){
				column.checkCellHeights();
			}
			
			document.body.removeEventListener("mouseup", mouseUp);
			document.body.removeEventListener("mousemove", mouseMove);
			
			handle.removeEventListener("touchmove", mouseMove);
			handle.removeEventListener("touchend", mouseUp);
			
			self.table.element.classList.remove("tabulator-block-select");
			
			if(self.startWidth !== column.getWidth()){
				self.dispatch("column-resized", column);
				self.table.externalEvents.dispatch("columnResized", column.getComponent());
			}
		}
		
		e.stopPropagation(); //prevent resize from interfereing with movable columns
		
		//block editor from taking action while resizing is taking place
		if(self.startColumn.modules.edit){
			self.startColumn.modules.edit.blocked = true;
		}
		
		self.startX = typeof e.screenX === "undefined" ? e.touches[0].screenX : e.screenX;
		self.startWidth = column.getWidth();
		
		document.body.addEventListener("mousemove", mouseMove);
		document.body.addEventListener("mouseup", mouseUp);
		handle.addEventListener("touchmove", mouseMove, {passive: true});
		handle.addEventListener("touchend", mouseUp);
	}
}

ResizeColumns.moduleName = "resizeColumns";

export default ResizeColumns;