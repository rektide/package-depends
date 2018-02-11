import ExtensibleFunction from "extensible-function"
import racePredicated from "promise-race-predicated"
import UnknownFilter from "unknown-filter"

import { dirname as pathDirname, join as pathJoin} from "path"
import { stat as fsStat, readFile as fsReadfile} from "pn/fs"

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
	base: "baseDependencies"
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
export class PackageDepends extends ExtensibleFunction{

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
	async depends( pkgNames){
		var targets= pkgNames
		if( typeof targets=== "string"){
			targets= [ targets]
		}
		if( !target){
			var
			  basePkgFile= await this._find( "package.json"),
			  basePkg= await loadJson( basePkg),
			// target all packages of whatever we can drum up as the "current" package
			target= await this._packageDependencies( basePkg)
		}
		console.log({ target})
	}
	/**
	* Find the directory
	* @param find - the path piece to find
	* @param start - the
	*/
	async _find( find, base= this.base){
		// recurse up through all paths until we find the package.json for the given name
		var
		  cur= base,
		  prev
		while( cur!= prev){
			var target= pathJoin( start, cur)
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
			return await racePredicated( finds, firstSuccessful)
		}catch(ex){
			throw new Error("Not found: "+ find)
		}
	}
	_packageDependencies( pkg){
		var
		  // for each enabled category, get all package names
		  pkgArrays= Object.keys( categoryMap).filter( this.isCategoryEnabled).forEach( cat=> Object.keys( pkg[ categoryMap[ cat]])),
		  unknownFilter= new UnknownFilter(),
		  // flatten and unique-ify
		  flattened= Array.prototype.concat.apply([], pkgArrays).filter( unknownFilter)
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
