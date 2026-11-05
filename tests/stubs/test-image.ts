/** Controllable image loader for components that wait for a browser load event. */
export class TestImage extends EventTarget {
  static instances: TestImage[] = []
  static cached = false
  private source = ''
  complete = false
  naturalWidth = 0

  constructor() {
    super()
    TestImage.instances.push(this)
  }

  get src() {
    return this.source
  }

  set src(value: string) {
    this.source = value
    this.complete = false
    this.naturalWidth = 0
    if (TestImage.cached) {
      this.complete = true
      this.naturalWidth = 64
    }
  }

  load() {
    this.complete = true
    this.naturalWidth = 64
    this.dispatchEvent(new Event('load'))
  }

  fail() {
    this.complete = true
    this.naturalWidth = 0
    this.dispatchEvent(new Event('error'))
  }
}
