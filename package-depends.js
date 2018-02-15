import promiseRacePredicated from "promise-race-predicated"
import AsyncIteratorMuxer from "async-iterator-muxer"
import UnknownFilter from "unknown-filter"

import { dirname as pathDirname, join as pathJoin} from "path"
import { stat as fsStat, readFile as fsReadFile} from "pn/fs"

process.on("unhandledRejection", console.error.bind(console))

export let defaults= {
	modulesDirs: [ "node_modules"],
	peer: true,
	optional: true,
	dev: false,
	base: true
}

var categoryMap= {
	peer: "peerDependencies",
	optional: "optionalDependencies",
	dev: "devDependencies",
	base: "dependencies"
}

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
	static set modulesDir( dirs){
		defaults.modulesDirs= dirs
	}
	static get peer(){
		return defaults.peer
	}
	static set peer( val){
		defaults.peer= val
	}
	static get optional(){
		return defaults.optional
	}
	static set optional( val){
		defaults.optional= val
	}
	static get dev(){
		return defaults.dev
	}
	static set dev( val){
		defaults.optional= val
	}
	static get base(){
		return defaults.base
	}
	static set base( val){
		defaults.base= val
	}

	/**
	* @param optionalPackageName - a specific package name to try to start from, else tries to find a current package to start from
	*/
	constructor( optionalPackageName, options= {}){
		Object.assign( this, options)

		// write state as non-enumerable properties
		Object.defineProperties( this, {
			_base: {
				value: options.base|| (options.module&& pathDirname( options.module.id))|| process.cwd(),
				writable: true
			},
			_unknown: {
				value: new UnknownFilter(),
				writable: true
			},
			isCategoryEnabled: {
				value: this.isCategoryEnabled.bind( this)
			},
			_packageDependencies: {
				value: this._packageDependencies.bind( this)
			},
			_deps: {
				value: this._deps.bind( this)
			}
		})
	}
	/**
	* Do the deed, list all dependencies
	*/
	async* depends( pkgNames){
		if( !pkgNames){
			pkgNames= ".."
		}
		if( typeof pkgNames=== "string"){
			pkgNames= [ pkgNames]
		}

		var
		  muxer= new AsyncIteratorMuxer(),
		  load= async( name)=>{
			// get dependencies
			var newDeps= this._deps( name)
			// queue newDeps for output when available
			muxer.add( newDeps)
			// await and recurse
			newDeps= await newDeps
			newDeps.forEach( load)
		  }
		pkgNames.forEach( load)
		return yield* muxer
	}
	/**
	* Recursively find a package's dependencies
	*/
	_deps( name){
		// find package.json
		var deps= this._findModule( pathJoin( name, "package.json"))
		  // load package.json file to js objeect
		  .then( loadJson)
		  // get it's dependency names
		  .then( this._packageDependencies)
		  // filter for dependencies we've never heard of
		  .then( pkgs=> pkgs.filter( this._unknown))
		return deps
	}
	/**
	* Walk up the tree looking in modulesDirs for the package
	*/
	async _findModule( find, base= this._base){
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
	async _find( find, base= this._base){
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
			cur= pathBasename( cur)
		}
		throw new Error("Not found: "+ find)
	}
	/**
	* For a pkg file, return a list of all dependencies for enabled types (optional, peer, dev, base, &c)
	*/
	_packageDependencies( pkg){
		var
		  // for each enabled category, get all package names
		  categories= Object.keys( categoryMap).filter( this.isCategoryEnabled),
		  pkgArrays= categories.map( cat=> Object.keys( pkg[ categoryMap[ cat]]||{})),
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
