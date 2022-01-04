import Module from '../../core/Module.js';
import Helpers from '../../core/tools/Helpers.js';

class Menu extends Module{
	
	constructor(table){
		super(table);
		
		this.menuElements = [];
		this.blurEvent = this.hideMenu.bind(this);
		this.escEvent = this.escMenu.bind(this);
		this.nestedMenuBlock = false;
		this.positionReversedX = false;

		this.currentComponent = null;

		this.columnSubscribers = {};
		
		this.registerTableOption("rowContextMenu", false);
		this.registerTableOption("rowClickMenu", false);
		this.registerTableOption("groupContextMenu", false);
		this.registerTableOption("groupClickMenu", false);
		
		this.registerColumnOption("headerContextMenu");
		this.registerColumnOption("headerClickMenu");
		this.registerColumnOption("headerMenu");
		this.registerColumnOption("contextMenu");
		this.registerColumnOption("clickMenu");
	}
	
	initialize(){
		this.subscribe("column-init", this.initializeColumn.bind(this));
		this.initializeRowWatchers();
		this.initializeGroupWatchers();
	}

	initializeRowWatchers(){
		if(this.table.options.rowContextMenu){
			this.subscribe("row-contextmenu", this.loadMenuEvent.bind(this, this.table.options.rowContextMenu));
			// this.tapHold(row, this.table.options.rowContextMenu); TODO - move tap events to the interaction monitor so they can be subscribed to here
		}
		
		if(this.table.options.rowClickMenu){
			this.subscribe("row-click", this.loadMenuEvent.bind(this, this.table.options.rowClickMenu));
		}
	}

	initializeGroupWatchers(){
		if(this.table.options.groupContextMenu){
			this.subscribe("group-contextmenu", this.loadMenuEvent.bind(this, this.table.options.groupContextMenu));
			// this.tapHold(group, this.table.options.groupContextMenu); TODO - move tap events to the interaction monitor so they can be subscribed to here
		}
		
		if(this.table.options.groupClickMenu){
			this.subscribe("group-click", this.loadMenuEvent.bind(this, this.table.options.groupClickMenu));
		}
	}
	
	initializeColumn(column){
		var options = ["headerContextMenu", "headerClickMenu"],
		def = column.definition;

		//handle column events
		if(def.headerContextMenu && !this.columnSubscribers.headerContextMenu){
			this.columnSubscribers.headerContextMenu = this.loadMenuTableColumnEvent.bind(this, "headerContextMenu");
			this.subscribe("column-contextmenu", this.columnSubscribers.headerContextMenu);

			//TODO - Handle Tap Hold Events
		}

		if(def.headerClickMenu && !this.columnSubscribers.headerClickMenu){
			this.columnSubscribers.headerClickMenu = this.loadMenuTableColumnEvent.bind(this, "headerClickMenu");
			this.subscribe("column-click", this.columnSubscribers.headerClickMenu);
		}
		
		//handle cell events
		if(def.contextMenu && !this.columnSubscribers.contextMenu){
			this.columnSubscribers.contextMenu = this.loadMenuTableCellEvent.bind(this, "contextMenu");
			this.subscribe("cell-contextmenu", this.columnSubscribers.contextMenu);

			//TODO - Handle Tap Hold Events
		}

		if(def.clickMenu && !this.columnSubscribers.clickMenu){
			this.columnSubscribers.clickMenu = this.loadMenuTableCellEvent.bind(this, "clickMenu");
			this.subscribe("cell-click", this.columnSubscribers.clickMenu);
		}
		
		if(def.headerMenu){
			this.initializeColumnHeaderMenu(column);
		}
	}
	
	initializeColumnHeaderMenu(column){
		var headerMenuEl;
			
		headerMenuEl = document.createElement("span");
		headerMenuEl.classList.add("tabulator-header-menu-button");
		headerMenuEl.innerHTML = "&vellip;";
		
		headerMenuEl.addEventListener("click", (e) => {
			e.stopPropagation();
			e.preventDefault();
			
			this.loadMenuEvent(column.definition.headerMenu, e, column);
		});
		
		column.titleElement.insertBefore(headerMenuEl, column.titleElement.firstChild);
	}

	loadMenuTableCellEvent(option, e, cell){
		if(cell.column.definition[option]){
			this.loadMenuEvent(cell.column.definition[option], e, cell);
		}
	}
	
	loadMenuTableColumnEvent(option, e, column){
		console.log("event", option)
		if(column.definition[option]){
			this.loadMenuEvent(column.definition[option], e, column);
		}
	}

	loadMenuEvent(menu, e, component){
		menu = typeof menu == "function" ? menu.call(this.table, component.getComponent(), e) : menu;

		this.loadMenu(e, component, menu);
	}
	
	tapHold(component, menu){
		var element = component.getElement(),
		tapHold = null,
		loaded = false;
		
		element.addEventListener("touchstart", (e) => {
			clearTimeout(tapHold);
			loaded = false;
			
			tapHold = setTimeout(() => {
				clearTimeout(tapHold);
				tapHold = null;
				loaded = true;
				
				this.loadMenuEvent(menu, e, component);
			}, 1000);
			
		}, {passive: true});
		
		element.addEventListener("touchend", (e) => {
			clearTimeout(tapHold);
			tapHold = null;
			
			if(loaded){
				e.preventDefault();
			}
		});
	}
	
	loadMenu(e, component, menu, parentEl){
		var touch = !(e instanceof MouseEvent);
		
		var menuEl = document.createElement("div");
		menuEl.classList.add("tabulator-menu");
		
		if(!touch){
			e.preventDefault();
		}
		
		//abort if no menu set
		if(!menu || !menu.length){
			return;
		}
		
		if(!parentEl){
			if(this.nestedMenuBlock){
				//abort if child menu already open
				if(this.isOpen()){
					return;
				}
			}else{
				this.nestedMenuBlock = setTimeout(() => {
					this.nestedMenuBlock = false;
				}, 100)
			}
			
			this.hideMenu();
			this.menuElements = [];
		}
		
		menu.forEach((item) => {
			var itemEl = document.createElement("div"),
			label = item.label,
			disabled = item.disabled;
			
			if(item.separator){
				itemEl.classList.add("tabulator-menu-separator");
			}else{
				itemEl.classList.add("tabulator-menu-item");
				
				if(typeof label == "function"){
					label = label.call(this.table, component.getComponent());
				}
				
				if(label instanceof Node){
					itemEl.appendChild(label);
				}else{
					itemEl.innerHTML = label;
				}
				
				if(typeof disabled == "function"){
					disabled = disabled.call(this.table, component.getComponent());
				}
				
				if(disabled){
					itemEl.classList.add("tabulator-menu-item-disabled");
					itemEl.addEventListener("click", (e) => {
						e.stopPropagation();
					});
				}else{
					if(item.menu && item.menu.length){
						itemEl.addEventListener("click", (e) => {
							e.stopPropagation();
							this.hideOldSubMenus(menuEl);
							this.loadMenu(e, component, item.menu, itemEl);
						});
					}else{
						if(item.action){
							itemEl.addEventListener("click", (e) => {
								item.action(e, component.getComponent());
							});
						}
					}
				}
				
				if(item.menu && item.menu.length){
					itemEl.classList.add("tabulator-menu-item-submenu");
				}
			}
			
			menuEl.appendChild(itemEl);
		});
		
		menuEl.addEventListener("click", (e) => {
			this.hideMenu();
		});
		
		this.menuElements.push(menuEl);
		this.positionMenu(menuEl, parentEl, touch, e);

		this.currentComponent = component
		
		this.dispatchExternal("menuOpened", component.getComponent())
	}
	
	hideOldSubMenus(menuEl){
		var index = this.menuElements.indexOf(menuEl);
		
		if(index > -1){
			for(let i = this.menuElements.length - 1; i > index; i--){
				var el = this.menuElements[i];
				
				if(el.parentNode){
					el.parentNode.removeChild(el);
				}
				
				this.menuElements.pop();
			}
		}
	}
	
	positionMenu(element, parentEl, touch, e){
		var docHeight = Math.max(document.body.offsetHeight, window.innerHeight),
		x, y, parentOffset;
		
		if(!parentEl){
			x = touch ? e.touches[0].pageX : e.pageX;
			y = touch ? e.touches[0].pageY : e.pageY;
			
			this.positionReversedX = false;
		}else{
			parentOffset = Helpers.elOffset(parentEl);
			x = parentOffset.left + parentEl.offsetWidth;
			y = parentOffset.top - 1;
		}
		
		element.style.top = y + "px";
		element.style.left = x + "px";
		
		setTimeout(() => {
			this.table.rowManager.element.addEventListener("scroll", this.blurEvent);
			document.body.addEventListener("click", this.blurEvent);
			document.body.addEventListener("contextmenu", this.blurEvent);
			window.addEventListener("resize", this.blurEvent);
			document.body.addEventListener("keydown", this.escEvent);
		}, 100);
		
		document.body.appendChild(element);
		
		//move menu to start on bottom edge if it is too close to the edge of the screen
		if((y + element.offsetHeight) >= docHeight){
			element.style.top = "";
			
			if(parentEl){
				element.style.bottom = (docHeight - parentOffset.top - parentEl.offsetHeight - 1) + "px";
			}else{
				element.style.bottom = (docHeight - y) + "px";
			}
		}
		
		//move menu to start on right edge if it is too close to the edge of the screen
		if((x + element.offsetWidth) >= document.body.offsetWidth || this.positionReversedX){
			element.style.left = "";
			
			if(parentEl){
				element.style.right = (document.documentElement.offsetWidth - parentOffset.left) + "px";
			}else{
				element.style.right = (document.documentElement.offsetWidth - x) + "px";
			}
			
			this.positionReversedX = true;
		}
	}
	
	isOpen(){
		return !!this.menuElements.length;
	}
	
	escMenu(e){
		if(e.keyCode == 27){
			this.hideMenu();
		}
	}
	
	hideMenu(){	
		this.menuElements.forEach((menuEl) => {
			if(menuEl.parentNode){
				menuEl.parentNode.removeChild(menuEl);
			}
		});
		
		document.body.removeEventListener("keydown", this.escEvent);
		document.body.removeEventListener("click", this.blurEvent);
		document.body.removeEventListener("contextmenu", this.blurEvent);
		window.removeEventListener("resize", this.blurEvent);
		this.table.rowManager.element.removeEventListener("scroll", this.blurEvent);
		
		if(this.currentComponent){
			this.dispatchExternal("menuClosed", this.currentComponent.getComponent());
			this.currentComponent = null;
		}
	}
}

Menu.moduleName = "menu";

export default Menu;