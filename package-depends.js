import promiseRacePredicated from "promise-race-predicated"
import AsyncIteratorMuxer from "async-iterator-muxer"
import UnknownFilter from "unknown-filter/unknown-filter.js"

import { dirname as pathDirname, join as pathJoin} from "path"
import { stat as fsStat, readFile as fsReadFile} from "pn/fs"

export let defaults= {
	modulesDirs: [ "node_modules"],
	peerDependencies: true,
	optionalDependencies: true,
	devDependencies: false,
	dependencies: true
}

export let _categories= [
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies"
]

function firstSuccessful( value, error){
	return !!value
}

export async function loadJson( filename){
	return await fsReadFile( filename, "utf8").then( JSON.parse)
}

/**
* Recurse through installed dependencies 
*/
export class PackageDepends{

	// expose defaults on class as well
	static get modulesDirs(){
		return defaults.modulesDirs
	}
	static set modulesDirs( dirs){
		defaults.modulesDirs= dirs
	}
	static get peerDependencies(){
		return defaults.peerDependencies
	}
	static set peerDependencies( val){
		defaults.peerDependencies= val
	}
	static get optionalDependencies(){
		return defaults.optionalDependencies
	}
	static set optionalDependencies( val){
		defaults.optionalDependencies= val
	}
	static get devDependencies(){
		return defaults.devDependencies
	}
	static set devDependencies( val){
		defaults.devDependencies= val
	}
	static get dependencies(){
		return defaults.dependencies
	}
	static set dependencies( val){
		defaults.dependencies= val
	}

	/**
	* @param optionalPackageName - a specific package name to try to start from, else tries to find a current package to start from
	*/
	constructor( options= {}){
		Object.assign( this, options)

		// write state as non-enumerable properties
		Object.defineProperties( this, {
			base: {
				value: options.base|| (options.module&& pathDirname( options.module.id))|| process.cwd(),
				writable: true
			},
			_unknown: {
				value: new UnknownFilter(),
				writable: true
			},
			isCategoryEnabled: {
				value: this.isCategoryEnabled.bind( this)
			}
		})
	}
	/**
	* Do the deed, list all dependencies
	*/
	async* depends( pkgNames, base= this.base){
		if( !pkgNames){
			pkgNames= this.pkgNames
		}
		if( !pkgNames){
			// we want "this" package, which won't be in node_modules
			pkgNames= ".."
		}
		if( typeof pkgNames=== "string"){
			pkgNames= [ pkgNames]
		}
		var
		  muxer= new AsyncIteratorMuxer(),
		  trimmer= val=> val.startsWith( this.base)? val.slice( this.base.length+ 1): val,
		  load= async( name, pkgBase)=>{
			var
			  // find package.json filename
			  filename= this._findModule( pathJoin( name, "package.json"), pkgBase),
			  // get deps
			  newDeps= filename
				// load package.json file to js objeect
				.then( loadJson)
				// get it's dependency names
				.then( async pkg=> {
					var
					  base= pathDirname( await filename),
					  newDeps= this
						// find relevant deps
						._packageDependencies( pkg)
						// filter for unknown ones
						.filter( this._unknown)
						// load
						.map( dep=> load( dep, base))
					return newDeps
				})
			// queue newDeps for output when available
			muxer.add( newDeps)
			// resolve filename and trim
			var resolved= pathDirname( await filename)
			if( this.trim){
				resolved= trimmer( resolved)
			}
			return resolved
		  }
		pkgNames.forEach( pkgName=> load( pkgName, base))
		return yield* muxer
	}
	/**
	* Walk up the tree looking in modulesDirs for the package
	*/
	async _findModule( find, base= this.base){
		var __find= async ( modulesDir)=> {
			var
			  sought= pathJoin( modulesDir, find),
			  found= await this._find( sought, base)
			return found
		}
		var
		  dirs= this.modulesDirs|| PackageDepends.modulesDirs,
		  // launch a find for each known modulesDir
		  finds= dirs.map( __find)
		try{
			// return the first successful find
			return await promiseRacePredicated( finds, firstSuccessful)
		}catch(ex){
			throw new Error("Not found: "+ find)
		}
	}
	/**
	* Walk up in directories, looking for `find`
	* @param find - the path piece to find
	* @param start - the
	*/
	async _find( find, base= this.base){
		// recurse up through all paths until we find the package.json for the given name
		var
		  cur= base,
		  prev
		while( cur!= prev){
			var target= pathJoin( cur, find)
			try{
				await fsStat( target)
				return target
			}catch( ex){}
			prev= cur
			cur= pathDirname( cur)
		}
		throw new Error("Not found: "+ find)
	}
	/**
	* For a pkg file, return a list of all dependencies for enabled types (optional, peer, dev, base, &c)
	*/
	_packageDependencies( pkg){
		var
		  // for each enabled category, get all package names
		  categories= _categories.filter( this.isCategoryEnabled),
		  pkgArrays= categories.map( cat=> Object.keys( pkg[ cat]||{})),
		  // flatten and unique-ify
		  flattened= Array.prototype.concat.apply([], pkgArrays).filter( new UnknownFilter())
		return flattened
	}
	/**
	* Return whether a given category of package is enabled
	*/
	isCategoryEnabled( name){
		if( this[ name]=== undefined){
			if( !PackageDepends[ name]){
				return false
			}
		}else if( !this[ name]){
			return false
		}
		return true
	}
}
export default PackageDepends
