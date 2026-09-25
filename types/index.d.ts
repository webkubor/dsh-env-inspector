/**
 * @dsh-plugins/dsh-env-inspector TypeScript Definitions
 */

export const name: '@dsh-plugins/dsh-env-inspector'
export const inject: string[]

export interface SystemInfo {
	os: string
	arch: string
	hostname: string
	uptimeSeconds: number
	totalMemMb: number
	freeMemMb: number
	loadAvg: number[]
	cpus: number
}

export interface CliToolResult {
	name: string
	ok: boolean
	version: string | null
}

export interface HardwareDisplay {
	resolution: string | null
	main: boolean
}

export interface HardwareInfo {
	ok: boolean
	displays: HardwareDisplay[]
	gpus: number | null
	memorySlots: string | null
	cpuType?: string | null
	osVersion?: string | null
}

export interface InstalledPlugin {
	profile: string
	plugin: string
	version: string
}

export interface EnvKeyResult {
	name: string
	configured: boolean
}

export interface NetworkInterfaceSummary {
	name: string
	family: 'IPv4' | 'IPv6'
	address: string
	internal: boolean
}

export interface NetworkProxySummary {
	configured: boolean
	source: string | null
}

export interface NetworkSummary {
	primaryIp: string | null
	interfaces: NetworkInterfaceSummary[]
	proxy: NetworkProxySummary
}

export interface ListeningPort {
	port: number
	command: string
	pid: number
	user: string
	fd: string
	type: string
	device: string
	sizeOff: string
	node: string
	rawName: string
	isWildcard: boolean
}

export interface SelfCheckPayload {
	ok: true
	at: number
	system: SystemInfo
	cli: CliToolResult[]
	ai: CliToolResult[]
	languages: CliToolResult[]
	hardware: HardwareInfo
	plugins: InstalledPlugin[]
	envKeys: EnvKeyResult[]
	network: NetworkSummary
	ports: ListeningPort[]
}

export interface KillPortParams {
	port: number
	pid: number
}

export interface KillPortResult {
	ok: boolean
	error?: string
	message?: string
}

export function probeAsync(cmd: string, args?: string[]): Promise<{ ok: boolean; version: string | null }>
export function probeCliToolsAsync(): Promise<CliToolResult[]>
export function probeAiToolsAsync(): Promise<CliToolResult[]>
export function probeLanguageToolsAsync(): Promise<CliToolResult[]>
export function probeHardwareAsync(): Promise<HardwareInfo>
export function parseListeningPorts(stdout: string): ListeningPort[]
export function probeListeningPorts(): ListeningPort[]
export function probeListeningPortsAsync(): Promise<ListeningPort[]>
export function readSelfCheckAsync(): Promise<SelfCheckPayload>
export function killProcessOnPort(param: KillPortParams): Promise<KillPortResult>
export function apply(ctx: any): void
