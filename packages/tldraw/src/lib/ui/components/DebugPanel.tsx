import {
	createShapeId,
	DebugFlag,
	debugFlags,
	Editor,
	featureFlags,
	hardResetEditor,
	TLShapePartial,
	track,
	uniqueId,
	useEditor,
	useValue,
	Vec,
} from '@tldraw/editor'
import * as React from 'react'
import { useDialogs } from '../hooks/useDialogsProvider'
import { useToasts } from '../hooks/useToastsProvider'
import { untranslated, useTranslation } from '../hooks/useTranslation/useTranslation'
import { Button } from './primitives/Button'
import * as Dialog from './primitives/Dialog'
import * as DropdownMenu from './primitives/DropdownMenu'

let t = 0

function createNShapes(editor: Editor, n: number) {
	const shapesToCreate: TLShapePartial[] = Array(n)
	const cols = Math.floor(Math.sqrt(n))

	for (let i = 0; i < n; i++) {
		t++
		shapesToCreate[i] = {
			id: createShapeId('box' + t),
			type: 'geo',
			x: (i % cols) * 132,
			y: Math.floor(i / cols) * 132,
		}
	}

	editor.batch(() => {
		editor.createShapes(shapesToCreate).setSelectedShapes(shapesToCreate.map((s) => s.id))
	})
}

/** @internal */
export const DebugPanel = React.memo(function DebugPanel({
	renderDebugMenuItems,
}: {
	renderDebugMenuItems: (() => React.ReactNode) | null
}) {
	const msg = useTranslation()
	const showFps = useValue('show_fps', () => debugFlags.showFps.get(), [debugFlags])

	return (
		<div className="tlui-debug-panel">
			<CurrentState />
			{showFps && <FPS />}
			<ShapeCount />
			<DropdownMenu.Root id="debug">
				<DropdownMenu.Trigger>
					<Button type="icon" icon="dots-horizontal" title={msg('debug-panel.more')} />
				</DropdownMenu.Trigger>
				<DropdownMenu.Content side="top" align="end" alignOffset={0}>
					<DebugMenuContent renderDebugMenuItems={renderDebugMenuItems} />
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	)
})

function useTick(isEnabled = true) {
	const [_, setTick] = React.useState(0)
	const editor = useEditor()
	React.useEffect(() => {
		if (!isEnabled) return
		const update = () => setTick((tick) => tick + 1)
		editor.on('tick', update)
		return () => {
			editor.off('tick', update)
		}
	}, [editor, isEnabled])
}

const CurrentState = track(function CurrentState() {
	useTick()

	const editor = useEditor()

	const path = editor.getPath()
	const hoverShape = editor.getHoveredShape()
	const selectedShape = editor.getOnlySelectedShape()
	const shape = path === 'select.idle' || !path.includes('select.') ? hoverShape : selectedShape
	const shapeInfo =
		shape && path.includes('select.')
			? ` / ${shape.type || ''}${
					'geo' in shape.props ? ' / ' + shape.props.geo : ''
				} / [${Vec.ToFixed(editor.getPointInShapeSpace(shape, editor.inputs.currentPagePoint), 0)}]`
			: ''
	const ruler =
		path.startsWith('select.') && !path.includes('.idle')
			? ` / [${Vec.ToFixed(editor.inputs.originPagePoint, 0)}] → [${Vec.ToFixed(
					editor.inputs.currentPagePoint,
					0
				)}] = ${Vec.Dist(editor.inputs.originPagePoint, editor.inputs.currentPagePoint).toFixed(0)}`
			: ''

	return <div className="tlui-debug-panel__current-state">{`${path}${shapeInfo}${ruler}`}</div>
})

function FPS() {
	const fpsRef = React.useRef<HTMLDivElement>(null)

	React.useEffect(() => {
		const TICK_LENGTH = 250
		let maxKnownFps = 0
		let cancelled = false

		let start = performance.now()
		let currentTickLength = 0
		let framesInCurrentTick = 0
		let isSlow = false

		// A "tick" is the amount of time between renders. Even though
		// we'll loop on every frame, we will only paint when the time
		// since the last paint is greater than the tick length.

		// When we paint, we'll calculate the FPS based on the number
		// of frames that we've seen since the last time we rendered,
		// and the actual time since the last render.
		function loop() {
			if (cancelled) return

			// Count the frame
			framesInCurrentTick++

			// Check if we should render
			currentTickLength = performance.now() - start

			if (currentTickLength > TICK_LENGTH) {
				// Calculate the FPS and paint it
				const fps = Math.round(
					framesInCurrentTick * (TICK_LENGTH / currentTickLength) * (1000 / TICK_LENGTH)
				)

				if (fps > maxKnownFps) {
					maxKnownFps = fps
				}

				const slowFps = maxKnownFps * 0.75
				if ((fps < slowFps && !isSlow) || (fps >= slowFps && isSlow)) {
					isSlow = !isSlow
				}

				fpsRef.current!.innerHTML = `FPS ${fps.toString()}`
				fpsRef.current!.className =
					`tlui-debug-panel__fps` + (isSlow ? ` tlui-debug-panel__fps__slow` : ``)

				// Reset the values
				currentTickLength -= TICK_LENGTH
				framesInCurrentTick = 0
				start = performance.now()
			}

			requestAnimationFrame(loop)
		}

		loop()

		return () => {
			cancelled = true
		}
	}, [])

	return <div ref={fpsRef} />
}

const ShapeCount = function ShapeCount() {
	const editor = useEditor()
	const count = useValue('rendering shapes count', () => editor.getRenderingShapes().length, [
		editor,
	])

	return <div>{count} Shapes</div>
}

const DebugMenuContent = track(function DebugMenuContent({
	renderDebugMenuItems,
}: {
	renderDebugMenuItems: (() => React.ReactNode) | null
}) {
	const editor = useEditor()
	const { addToast } = useToasts()
	const { addDialog } = useDialogs()
	const [error, setError] = React.useState<boolean>(false)

	return (
		<>
			<DropdownMenu.Group>
				<DropdownMenu.Item
					type="menu"
					onClick={() => {
						addToast({
							id: uniqueId(),
							title: 'Something happened',
							description: 'Hey, attend to this thing over here. It might be important!',
							keepOpen: true,
							// icon?: string
							// title?: string
							// description?: string
							// actions?: TLUiToastAction[]
						})
						addToast({
							id: uniqueId(),
							title: 'Something happened',
							description: 'Hey, attend to this thing over here. It might be important!',
							keepOpen: true,
							actions: [
								{
									label: 'Primary',
									type: 'primary',
									onClick: () => {
										void null
									},
								},
								{
									label: 'Normal',
									type: 'normal',
									onClick: () => {
										void null
									},
								},
								{
									label: 'Danger',
									type: 'danger',
									onClick: () => {
										void null
									},
								},
							],
							// icon?: string
							// title?: string
							// description?: string
							// actions?: TLUiToastAction[]
						})
						addToast({
							id: uniqueId(),
							title: 'Something happened',
							description: 'Hey, attend to this thing over here. It might be important!',
							keepOpen: true,
							icon: 'twitter',
							actions: [
								{
									label: 'Primary',
									type: 'primary',
									onClick: () => {
										void null
									},
								},
								{
									label: 'Normal',
									type: 'normal',
									onClick: () => {
										void null
									},
								},
								{
									label: 'Danger',
									type: 'danger',
									onClick: () => {
										void null
									},
								},
							],
						})
					}}
					label={untranslated('Show toast')}
				/>

				<DropdownMenu.Item
					type="menu"
					onClick={() => {
						addDialog({
							component: ({ onClose }) => (
								<ExampleDialog
									displayDontShowAgain
									onCancel={() => {
										onClose()
									}}
									onContinue={() => {
										onClose()
									}}
								/>
							),
							onClose: () => {
								void null
							},
						})
					}}
					label={untranslated('Show dialog')}
				/>
				<DropdownMenu.Item
					type="menu"
					onClick={() => createNShapes(editor, 100)}
					label={untranslated('Create 100 shapes')}
				/>
				<DropdownMenu.Item
					type="menu"
					onClick={() => {
						function countDescendants({ children }: HTMLElement) {
							let count = 0
							if (!children.length) return 0
							for (const el of [...(children as any)]) {
								count++
								count += countDescendants(el)
							}
							return count
						}

						const selectedShapes = editor.getSelectedShapes()

						const shapes =
							selectedShapes.length === 0 ? editor.getRenderingShapes() : selectedShapes

						const elms = shapes.map(
							(shape) => (document.getElementById(shape.id) as HTMLElement)!.parentElement!
						)

						let descendants = elms.length

						for (const elm of elms) {
							descendants += countDescendants(elm)
						}

						window.alert(`Shapes ${shapes.length}, DOM nodes:${descendants}`)
					}}
					label={untranslated('Count shapes / nodes')}
				/>
				{(() => {
					if (error) throw Error('oh no!')
				})()}
				<DropdownMenu.Item
					type="menu"
					onClick={() => {
						setError(true)
					}}
					label={untranslated('Throw error')}
				/>
				<DropdownMenu.Item
					type="menu"
					onClick={() => {
						hardResetEditor()
					}}
					label={untranslated('Hard reset')}
				/>
			</DropdownMenu.Group>
			<DropdownMenu.Group>
				<DebugFlagToggle flag={debugFlags.debugSvg} />
				<DebugFlagToggle flag={debugFlags.showFps} />
				<DebugFlagToggle flag={debugFlags.forceSrgb} />
				<DebugFlagToggle flag={debugFlags.debugGeometry} />
				<DebugFlagToggle flag={debugFlags.hideShapes} />
			</DropdownMenu.Group>
			<DropdownMenu.Group>
				{Object.values(featureFlags).map((flag) => {
					return <DebugFlagToggle key={flag.name} flag={flag} />
				})}
			</DropdownMenu.Group>
			{renderDebugMenuItems?.()}
		</>
	)
})

function Toggle({
	label,
	value,
	onChange,
}: {
	label: string
	value: boolean
	onChange: (newValue: boolean) => void
}) {
	return (
		<DropdownMenu.CheckboxItem
			title={untranslated(label)}
			checked={value}
			onSelect={() => onChange(!value)}
		>
			<span className="tlui-button__label" draggable={false}>
				{label}
			</span>
		</DropdownMenu.CheckboxItem>
	)
}

const DebugFlagToggle = track(function DebugFlagToggle({
	flag,
	onChange,
}: {
	flag: DebugFlag<boolean>
	onChange?: (newValue: boolean) => void
}) {
	return (
		<Toggle
			label={flag.name
				.replace(/([a-z0-9])([A-Z])/g, (m) => `${m[0]} ${m[1].toLowerCase()}`)
				.replace(/^[a-z]/, (m) => m.toUpperCase())}
			value={flag.get()}
			onChange={(newValue) => {
				flag.set(newValue)
				onChange?.(newValue)
			}}
		/>
	)
})

function ExampleDialog({
	title = 'title',
	body = 'hello hello hello',
	cancel = 'Cancel',
	confirm = 'Continue',
	displayDontShowAgain = false,
	onCancel,
	onContinue,
}: {
	title?: string
	body?: string
	cancel?: string
	confirm?: string
	displayDontShowAgain?: boolean
	onCancel: () => void
	onContinue: () => void
}) {
	const [dontShowAgain, setDontShowAgain] = React.useState(false)

	return (
		<>
			<Dialog.Header>
				<Dialog.Title>{title}</Dialog.Title>
				<Dialog.CloseButton />
			</Dialog.Header>
			<Dialog.Body style={{ maxWidth: 350 }}>{body}</Dialog.Body>
			<Dialog.Footer className="tlui-dialog__footer__actions">
				{displayDontShowAgain && (
					<Button
						type="normal"
						onClick={() => setDontShowAgain(!dontShowAgain)}
						iconLeft={dontShowAgain ? 'check' : 'checkbox-empty'}
						style={{ marginRight: 'auto' }}
					>
						{`Don't show again`}
					</Button>
				)}
				<Button type="normal" onClick={onCancel}>
					{cancel}
				</Button>
				<Button type="primary" onClick={async () => onContinue()}>
					{confirm}
				</Button>
			</Dialog.Footer>
		</>
	)
}
