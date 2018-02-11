import { Bound} from "extensible-function"
import promiseRacePredicated from "promise-race-predicated"
import UnknownFilter from "unknown-filter"

import { dirname as pathDirname, join as pathJoin} from "path"
import { stat as fsStat, readFile as fsReadFile} from "pn/fs"

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
export class PackageDepends extends Bound{

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
		super( PackageDepends.prototype.depends, optionalPackageName)
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
			}
		})
	}
	/**
	* Do the deed, list all dependencies
	*/
	async* depends( pkgNames){
		var targets= pkgNames
		if( typeof targets=== "string"){
			targets= [ targets]
		}
		if( !targets){
			var
			  basePkgFile= await this._find( "package.json"),
			  basePkg= await loadJson( basePkgFile)
			// target all packages of whatever we can drum up as the "current" package
			targets= await this._packageDependencies( basePkg)
		}
		console.log({ targets})
	}
	/**
	* Find the directory
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
	* Walk up in directories, looking for `find` inside of a directory in `modulesDirs`.
	*/
	async _findModule( find, base= this.base){
		async function __find( modulesDir){
			try{
				var moduleBase= path.join( base, modulesDir)
				return await this._find( find, moduleBase)
			}catch( ex){}
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
