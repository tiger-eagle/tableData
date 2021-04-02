import Module from '../../core/Module.js';

import defaultFilters from './defaults/filters.js';

class Filter extends Module{

	constructor(table){
		super(table);

		this.filterList = []; //hold filter list
		this.headerFilters = {}; //hold column filters
		this.headerFilterColumns = []; //hold columns that use header filters

		this.prevHeaderFilterChangeCheck = "";
		this.prevHeaderFilterChangeCheck = "{}";

		this.changed = false; //has filtering changed since last render
	}

	initialize(){
		this.subscribe("column-init", this.initializeColumnHeaderFilter.bind(this));
		this.subscribe("column-width-fit-before", this.hideHeaderFilterElements.bind(this));
		this.subscribe("column-width-fit-after", this.showHeaderFilterElements.bind(this));

		this.registerDataHandler(this.filter.bind(this), 10);
	}

	initializeColumnHeaderFilter(column){
		var def = column.definition;

		if(def.headerFilter){

			if(typeof def.headerFilterPlaceholder !== "undefined" && def.field){
				this.module("localize").setHeaderFilterColumnPlaceholder(def.field, def.headerFilterPlaceholder);
			}

			this.initializeColumn(column);
		}
	}

	//initialize column header filter
	initializeColumn(column, value){
		var self = this,
		field = column.getField(),
		params;

		//handle successfull value change
		function success(value){
			var filterType = (column.modules.filter.tagType == "input" && column.modules.filter.attrType == "text") || column.modules.filter.tagType == "textarea" ? "partial" : "match",
			type = "",
			filterChangeCheck = "",
			filterFunc;

			if(typeof column.modules.filter.prevSuccess === "undefined" || column.modules.filter.prevSuccess !== value){

				column.modules.filter.prevSuccess = value;

				if(!column.modules.filter.emptyFunc(value)){
					column.modules.filter.value = value;

					switch(typeof column.definition.headerFilterFunc){
						case "string":
						if(Filter.filters[column.definition.headerFilterFunc]){
							type = column.definition.headerFilterFunc;
							filterFunc = function(data){
								var params = column.definition.headerFilterFuncParams || {};
								var fieldVal = column.getFieldValue(data);

								params = typeof params === "function" ? params(value, fieldVal, data) : params;

								return Filter.filters[column.definition.headerFilterFunc](value, fieldVal, data, params);
							};
						}else{
							console.warn("Header Filter Error - Matching filter function not found: ", column.definition.headerFilterFunc);
						}
						break;

						case "function":
						filterFunc = function(data){
							var params = column.definition.headerFilterFuncParams || {};
							var fieldVal = column.getFieldValue(data);

							params = typeof params === "function" ? params(value, fieldVal, data) : params;

							return column.definition.headerFilterFunc(value, fieldVal, data, params);
						};

						type = filterFunc;
						break;
					}

					if(!filterFunc){
						switch(filterType){
							case "partial":
							filterFunc = function(data){
								var colVal = column.getFieldValue(data);

								if(typeof colVal !== 'undefined' && colVal !== null){
									return String(colVal).toLowerCase().indexOf(String(value).toLowerCase()) > -1;
								}else{
									return false;
								}
							};
							type = "like";
							break;

							default:
							filterFunc = function(data){
								return column.getFieldValue(data) == value;
							};
							type = "=";
						}
					}

					self.headerFilters[field] = {value:value, func:filterFunc, type:type, params:params || {}};

				}else{
					delete self.headerFilters[field];
				}

				filterChangeCheck = JSON.stringify(self.headerFilters);

				if(self.prevHeaderFilterChangeCheck !== filterChangeCheck){
					self.prevHeaderFilterChangeCheck = filterChangeCheck;

					self.changed = true;
					self.table.rowManager.filterRefresh();
				}
			}

			return true;
		}

		column.modules.filter = {
			success:success,
			attrType:false,
			tagType:false,
			emptyFunc:false,
		};

		this.generateHeaderFilterElement(column);
	}

	generateHeaderFilterElement(column, initialValue, reinitialize){
		var self = this,
		success = column.modules.filter.success,
		field = column.getField(),
		filterElement, editor, editorElement, cellWrapper, typingTimer, searchTrigger, params;

		//handle aborted edit
		function cancel(){}

		if(column.modules.filter.headerElement && column.modules.filter.headerElement.parentNode){
			column.contentElement.removeChild(column.modules.filter.headerElement.parentNode);
		}

		if(field){

			//set empty value function
			column.modules.filter.emptyFunc = column.definition.headerFilterEmptyCheck || function(value){
				return !value && value !== "0" && value !== 0;
			};

			filterElement = document.createElement("div");
			filterElement.classList.add("tabulator-header-filter");

			//set column editor
			switch(typeof column.definition.headerFilter){
				case "string":
				if(self.table.modules.edit.editors[column.definition.headerFilter]){
					editor = self.table.modules.edit.editors[column.definition.headerFilter];

					if((column.definition.headerFilter === "tick" || column.definition.headerFilter === "tickCross") && !column.definition.headerFilterEmptyCheck){
						column.modules.filter.emptyFunc = function(value){
							return value !== true && value !== false;
						};
					}
				}else{
					console.warn("Filter Error - Cannot build header filter, No such editor found: ", column.definition.editor);
				}
				break;

				case "function":
				editor = column.definition.headerFilter;
				break;

				case "boolean":
				if(column.modules.edit && column.modules.edit.editor){
					editor = column.modules.edit.editor;
				}else{
					if(column.definition.formatter && self.table.modules.edit.editors[column.definition.formatter]){
						editor = self.table.modules.edit.editors[column.definition.formatter];

						if((column.definition.formatter === "tick" || column.definition.formatter === "tickCross") && !column.definition.headerFilterEmptyCheck){
							column.modules.filter.emptyFunc = function(value){
								return value !== true && value !== false;
							};
						}
					}else{
						editor = self.table.modules.edit.editors["input"];
					}
				}
				break;
			}

			if(editor){

				cellWrapper = {
					getValue:function(){
						return typeof initialValue !== "undefined" ? initialValue : "";
					},
					getField:function(){
						return column.definition.field;
					},
					getElement:function(){
						return filterElement;
					},
					getColumn:function(){
						return column.getComponent();
					},
					getRow:function(){
						return {
							normalizeHeight:function(){

							}
						};
					}
				};

				params = column.definition.headerFilterParams || {};

				params = typeof params === "function" ? params.call(self.table) : params;

				editorElement = editor.call(this.table.modules.edit, cellWrapper, function(){}, success, cancel, params);

				if(!editorElement){
					console.warn("Filter Error - Cannot add filter to " + field + " column, editor returned a value of false");
					return;
				}

				if(!(editorElement instanceof Node)){
					console.warn("Filter Error - Cannot add filter to " + field + " column, editor should return an instance of Node, the editor returned:", editorElement);
					return;
				}

				//set Placeholder Text
				if(field){
					self.table.modules.localize.bind("headerFilters|columns|" + column.definition.field, function(value){
						editorElement.setAttribute("placeholder", typeof value !== "undefined" && value ? value : self.table.modules.localize.getText("headerFilters|default"));
					});
				}else{
					self.table.modules.localize.bind("headerFilters|default", function(value){
						editorElement.setAttribute("placeholder", typeof self.column.definition.headerFilterPlaceholder !== "undefined" && self.column.definition.headerFilterPlaceholder ? self.column.definition.headerFilterPlaceholder : value);
					});
				}

				//focus on element on click
				editorElement.addEventListener("click", function(e){
					e.stopPropagation();
					editorElement.focus();
				});

				editorElement.addEventListener("focus", (e) => {
					var left = this.table.columnManager.element.scrollLeft;

					if(left !== this.table.rowManager.element.scrollLeft){
						this.table.rowManager.scrollHorizontal(left);
						this.table.columnManager.scrollHorizontal(left);
					}
				});

				//live update filters as user types
				typingTimer = false;

				searchTrigger = function(e){
					if(typingTimer){
						clearTimeout(typingTimer);
					}

					typingTimer = setTimeout(function(){
						success(editorElement.value);
					},self.table.options.headerFilterLiveFilterDelay);
				};

				column.modules.filter.headerElement = editorElement;
				column.modules.filter.attrType = editorElement.hasAttribute("type") ? editorElement.getAttribute("type").toLowerCase() : "" ;
				column.modules.filter.tagType = editorElement.tagName.toLowerCase();

				if(column.definition.headerFilterLiveFilter !== false){

					if (
						!(
							column.definition.headerFilter === 'autocomplete' ||
							column.definition.headerFilter === 'tickCross' ||
							((column.definition.editor === 'autocomplete' ||
								column.definition.editor === 'tickCross') &&
							column.definition.headerFilter === true)
							)
						) {
						editorElement.addEventListener("keyup", searchTrigger);
					editorElement.addEventListener("search", searchTrigger);


					//update number filtered columns on change
					if(column.modules.filter.attrType == "number"){
						editorElement.addEventListener("change", function(e){
							success(editorElement.value);
						});
					}

					//change text inputs to search inputs to allow for clearing of field
					if(column.modules.filter.attrType == "text" && this.table.browser !== "ie"){
						editorElement.setAttribute("type", "search");
						// editorElement.off("change blur"); //prevent blur from triggering filter and preventing selection click
					}

				}

					//prevent input and select elements from propegating click to column sorters etc
					if(column.modules.filter.tagType == "input" || column.modules.filter.tagType == "select" || column.modules.filter.tagType == "textarea"){
						editorElement.addEventListener("mousedown",function(e){
							e.stopPropagation();
						});
					}
				}

				filterElement.appendChild(editorElement);

				column.contentElement.appendChild(filterElement);

				if(!reinitialize){
					self.headerFilterColumns.push(column);
				}
			}
		}else{
			console.warn("Filter Error - Cannot add header filter, column has no field set:", column.definition.title);
		}
	}

	//hide all header filter elements (used to ensure correct column widths in "fitData" layout mode)
	hideHeaderFilterElements(){
		this.headerFilterColumns.forEach(function(column){
			if(column.modules.filter && column.modules.filter.headerElement){
				column.modules.filter.headerElement.style.display = 'none';
			}
		});
	}

	//show all header filter elements (used to ensure correct column widths in "fitData" layout mode)
	showHeaderFilterElements(){
		this.headerFilterColumns.forEach(function(column){
			if(column.modules.filter && column.modules.filter.headerElement){
				column.modules.filter.headerElement.style.display = '';
			}
		});
	}

	//programatically set focus of header filter
	setHeaderFilterFocus(column){
		if(column.modules.filter && column.modules.filter.headerElement){
			column.modules.filter.headerElement.focus();
		}else{
			console.warn("Column Filter Focus Error - No header filter set on column:", column.getField());
		}
	}

	//programmatically get value of header filter
	getHeaderFilterValue(column){
		if(column.modules.filter && column.modules.filter.headerElement){
			return column.modules.filter.headerElement.value;
		} else {
			console.warn("Column Filter Error - No header filter set on column:", column.getField());
		}
	}

	//programatically set value of header filter
	setHeaderFilterValue(column, value){
		if (column){
			if(column.modules.filter && column.modules.filter.headerElement){
				this.generateHeaderFilterElement(column, value, true);
				column.modules.filter.success(value);
			}else{
				console.warn("Column Filter Error - No header filter set on column:", column.getField());
			}
		}
	}

	reloadHeaderFilter(column){
		if (column){
			if(column.modules.filter && column.modules.filter.headerElement){
				this.generateHeaderFilterElement(column, column.modules.filter.value, true);
			}else{
				console.warn("Column Filter Error - No header filter set on column:", column.getField());
			}
		}
	}

	//check if the filters has changed since last use
	hasChanged(){
		var changed = this.changed;
		this.changed = false;
		return changed;
	}

	//set standard filters
	setFilter(field, type, value, params){
		var self = this;

		self.filterList = [];

		if(!Array.isArray(field)){
			field = [{field:field, type:type, value:value, params:params}];
		}

		self.addFilter(field);
	}

	//add filter to array
	addFilter(field, type, value, params){
		var self = this;

		if(!Array.isArray(field)){
			field = [{field:field, type:type, value:value, params:params}];
		}

		field.forEach(function(filter){

			filter = self.findFilter(filter);

			if(filter){
				self.filterList.push(filter);

				self.changed = true;
			}
		});

		if(this.table.options.persistence && this.table.modExists("persistence", true) && this.table.modules.persistence.config.filter){
			this.table.modules.persistence.save("filter");
		}
	}

	findFilter(filter){
		var self = this,
		column;

		if(Array.isArray(filter)){
			return this.findSubFilters(filter);
		}

		var filterFunc = false;

		if(typeof filter.field == "function"){
			filterFunc = function(data){
				return filter.field(data, filter.type || {})// pass params to custom filter function
			};
		}else{

			if(Filter.filters[filter.type]){

				column = self.table.columnManager.getColumnByField(filter.field);

				if(column){
					filterFunc = function(data){
						return Filter.filters[filter.type](filter.value, column.getFieldValue(data), data, filter.params || {});
					};
				}else{
					filterFunc = function(data){
						return Filter.filters[filter.type](filter.value, data[filter.field], data, filter.params || {});
					};
				}


			}else{
				console.warn("Filter Error - No such filter type found, ignoring: ", filter.type);
			}
		}

		filter.func = filterFunc;

		return filter.func ? filter : false;
	}

	findSubFilters(filters){
		var self = this,
		output = [];

		filters.forEach(function(filter){
			filter = self.findFilter(filter);

			if(filter){
				output.push(filter);
			}
		});

		return output.length ? output : false;
	}

	//get all filters
	getFilters(all, ajax){
		var output = [];

		if(all){
			output = this.getHeaderFilters();
		}

		if(ajax){
			output.forEach(function(item){
				if(typeof item.type == "function"){
					item.type = "function";
				}
			});
		}

		output = output.concat(this.filtersToArray(this.filterList, ajax));

		return output;
	}

	//filter to Object
	filtersToArray(filterList, ajax){
		var output = [];

		filterList.forEach((filter) => {
			var item;

			if(Array.isArray(filter)){
				output.push(this.filtersToArray(filter, ajax));
			}else{
				item = {field:filter.field, type:filter.type, value:filter.value}

				if(ajax){
					if(typeof item.type == "function"){
						item.type = "function";
					}
				}

				output.push(item);
			}
		});

		return output;
	}

	//get all filters
	getHeaderFilters(){
		var self = this,
		output = [];

		for(var key in this.headerFilters){
			output.push({field:key, type:this.headerFilters[key].type, value:this.headerFilters[key].value});
		}

		return output;
	}

	//remove filter from array
	removeFilter(field, type, value){
		var self = this;

		if(!Array.isArray(field)){
			field = [{field:field, type:type, value:value}];
		}

		field.forEach(function(filter){
			var index = -1;

			if(typeof filter.field == "object"){
				index = self.filterList.findIndex(function(element){
					return filter === element;
				});
			}else{
				index = self.filterList.findIndex(function(element){
					return filter.field === element.field && filter.type === element.type  && filter.value === element.value;
				});
			}

			if(index > -1){
				self.filterList.splice(index, 1);
				self.changed = true;
			}else{
				console.warn("Filter Error - No matching filter type found, ignoring: ", filter.type);
			}

		});

		if(this.table.options.persistence && this.table.modExists("persistence", true) && this.table.modules.persistence.config.filter){
			this.table.modules.persistence.save("filter");
		}
	}

	//clear filters
	clearFilter(all){
		this.filterList = [];

		if(all){
			this.clearHeaderFilter();
		}

		this.changed = true;

		if(this.table.options.persistence && this.table.modExists("persistence", true) && this.table.modules.persistence.config.filter){
			this.table.modules.persistence.save("filter");
		}
	}

	//clear header filters
	clearHeaderFilter(){
		var self = this;

		this.headerFilters = {};
		self.prevHeaderFilterChangeCheck = "{}";

		this.headerFilterColumns.forEach(function(column){
			if(typeof column.modules.filter.value !== "undefined"){
				delete column.modules.filter.value;
			}
			column.modules.filter.prevSuccess = undefined;
			self.reloadHeaderFilter(column);
		});

		this.changed = true;
	}

	//search data and return matching rows
	search (searchType, field, type, value){
		var self = this,
		activeRows = [],
		filterList = [];

		if(!Array.isArray(field)){
			field = [{field:field, type:type, value:value}];
		}

		field.forEach(function(filter){
			filter = self.findFilter(filter);

			if(filter){
				filterList.push(filter);
			}
		});

		this.table.rowManager.rows.forEach(function(row){
			var match = true;

			filterList.forEach(function(filter){
				if(!self.filterRecurse(filter, row.getData())){
					match = false;
				}
			});

			if(match){
				activeRows.push(searchType === "data" ? row.getData("data") : row.getComponent());
			}

		});

		return activeRows;
	}

	//filter row array
	filter(rowList, filters){
		var activeRows = [],
		activeRowComponents = [];

		if(this.subscribedExternal("dataFiltering")){
			this.dispatchExternal("dataFiltering", this.getFilters());
		}

		if(!this.table.options.ajaxFiltering && (this.filterList.length || Object.keys(this.headerFilters).length)){

			rowList.forEach((row) => {
				if(this.filterRow(row)){
					activeRows.push(row);
				}
			});

		}else{
			activeRows = rowList.slice(0);
		}

		if(this.subscribedExternal("dataFiltered")){

			activeRows.forEach((row) => {
				activeRowComponents.push(row.getComponent());
			});

			this.dispatchExternal("dataFiltered", this.getFilters(), activeRowComponents);
		}

		return activeRows;
	}

	//filter individual row
	filterRow(row, filters){
		var self = this,
		match = true,
		data = row.getData();

		self.filterList.forEach(function(filter){
			if(!self.filterRecurse(filter, data)){
				match = false;
			}
		});


		for(var field in self.headerFilters){
			if(!self.headerFilters[field].func(data)){
				match = false;
			}
		}

		return match;
	}

	filterRecurse(filter, data){
		var self = this,
		match = false;

		if(Array.isArray(filter)){
			filter.forEach(function(subFilter){
				if(self.filterRecurse(subFilter, data)){
					match = true;
				}
			});
		}else{
			match = filter.func(data);
		}

		return match;
	}
}

Filter.moduleName = "filter";

//load defaults
Filter.filters = defaultFilters;

export default Filter;