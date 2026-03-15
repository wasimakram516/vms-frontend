// Core UI / Navigation
import {
  Home as HomeIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
  Check as CheckIcon,
  Save as SaveIcon,
  Start as StartIcon,
  Stop as StopIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  FilterAlt as FilterIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Search as SearchIcon,
  Replay as ReplayIcon,
  Leaderboard as LeaderboardIcon,
  ViewModule as ModuleIcon,
  Menu as MenuIcon,
  Fullscreen as FullscreenIcon,
  Assignment as FormIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Language as LanguageIcon,
  RestoreFromTrash as RestoreIcon,
  Badge as BadgeIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";

// Social Media
import {
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  LinkedIn as LinkedInIcon,
  Twitter as TwitterIcon,
  WhatsApp as WhatsAppIcon,
} from "@mui/icons-material";

// Outlined / Extras
import {
  PersonOutline as PersonOutlineIcon,
  EmailOutlined as EmailOutlinedIcon,
  ApartmentOutlined as ApartmentOutlinedIcon,
  QueryBuilderOutlined as QueryBuilderOutlinedIcon,
  VpnKeyOutlined as VpnKeyOutlinedIcon,
  VerifiedOutlined as VerifiedOutlinedIcon,
  AssignmentOutlined as AssignmentOutlinedIcon,
  EventOutlined as EventOutlinedIcon,
} from "@mui/icons-material";

// Status & Feedback
import {
  Info as InfoIcon,
  Warning as WarningIcon,
  ErrorOutline as ErrorOutlineIcon,
  CheckCircle as CheckCircleIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
} from "@mui/icons-material";

// Authentication
import {
  Logout as LogoutIcon,
  Login as LoginIcon,
  PersonAdd as RegisterIcon,
} from "@mui/icons-material";

// File & Media
import {
  FileDownload as FileDownloadIcon,
  FileUpload as FileUploadIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Image as ImageIcon,
  Movie as VideoIcon,
  InsertDriveFile as FileIcon,
  PhotoLibrary as PhotoLibraryIcon,
  CameraAlt as CameraIcon,
  Wallpaper as WallpaperIcon,
} from "@mui/icons-material";

// Time & Location
import {
  LocationOn as LocationIcon,
  Event as EventIcon,
  AccessTime as AccessTimeIcon,
  TableRestaurant as TableRestaurantIcon,
} from "@mui/icons-material";

// Domain-Specific / App Features
import {
  AppRegistration as AppRegistrationIcon,
  QrCodeScanner as QrCodeScannerIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  PeopleAlt as PeopleAltIcon,
  Quiz as QuizIcon,
  Poll as PollIcon,
  ContentCopy as ContentCopyIcon,
  EmojiEvents as EmojiEventsIcon,
  SportsEsports as SportsEsportsIcon,
  Assignment as AssignmentIcon,
  HowToReg as HowToRegIcon,
  QrCode as QrCodeIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  FlashOn as FlashOnIcon,
  Print as PrintIcon,
  Key as KeyIcon,
  GridView as GridViewIcon,
  Insights as InsightsIcon,
} from "@mui/icons-material";

// Screen Sharing / Devices
import {
  ScreenShare as ScreenShareIcon,
  DesktopWindows as DesktopWindowsIcon,
  Devices as DevicesIcon,
  Monitor as MonitorIcon,
  Tv as TvIcon,
  SmartDisplay as SmartDisplayIcon,
  TabletMac as TabletMacIcon,
  Laptop as LaptopIcon,
  PhoneAndroid as PhoneAndroidIcon,
  PhoneIphone as PhoneIphoneIcon,
  Cast as CastIcon,
  ConnectedTv as ConnectedTvIcon,
  DeveloperBoard as DeveloperBoardIcon,
  SettingsInputHdmi as SettingsInputHdmiIcon,
  SettingsInputComponent as SettingsInputComponentIcon,
} from "@mui/icons-material";

// Miscellaneous
import {
  People as PeopleIcon,
  Forum as ForumIcon,
  ThumbUp as ThumbUpIcon,
  ThumbUpOffAlt as ThumbUpOffAltIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  SearchOff as EmptyIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  Send as SendIcon,
  Help as HelpIcon,
  Group as GroupIcon,
  Description as DescriptionIcon,
  MeetingRoom as DoorIcon,
  Desk as DeskIcon,
  CloudUpload as CloudIcon,
  Sync as SyncIcon,
  ReceiptLong as ListIcon,
  Chat as ChatIcon,
} from "@mui/icons-material";

const ICONS = {
  // Core UI / Navigation
  add: AddIcon,
  back: ArrowBackIcon,
  badge: BadgeIcon,
  expandLess: ExpandLessIcon,
  cancel: CancelIcon,
  check: CheckIcon,
  close: CloseIcon,
  create: AddIcon,
  delete: DeleteIcon,
  down: ExpandMoreIcon,
  expandMore: ExpandMoreIcon,
  edit: EditIcon,
  filter: FilterIcon,
  form: FormIcon,
  fullscreen: FullscreenIcon,
  hide: VisibilityOffIcon,
  history: HistoryIcon,
  home: HomeIcon,
  Language: LanguageIcon,
  list: ListIcon,
  menu: MenuIcon,
  module: ModuleIcon,
  next: ArrowForwardIcon,
  pause: PauseIcon,
  play: PlayArrowIcon,
  leaderboard: LeaderboardIcon,
  replay: ReplayIcon,
  results: LeaderboardIcon,
  resume: StopIcon,
  restore: RestoreIcon,
  save: SaveIcon,
  search: SearchIcon,
  settings: SettingsIcon,
  share: ShareIcon,
  star: StarIcon,
  starBorder: StarBorderIcon,
  start: StartIcon,
  stop: StopIcon,
  sync: SyncIcon,
  view: VisibilityIcon,

  // Status & Feedback
  checkCircle: CheckCircleIcon,
  checkCircleOutline: CheckCircleOutlineIcon,
  errorOutline: ErrorOutlineIcon,
  info: InfoIcon,
  warning: WarningIcon,

  // Authentication
  login: LoginIcon,
  logout: LogoutIcon,
  register: RegisterIcon,

  // File & Media
  camera: CameraIcon,
  download: FileDownloadIcon,
  files: FileIcon,
  image: ImageIcon,
  library: PhotoLibraryIcon,
  pdf: PictureAsPdfIcon,
  upload: FileUploadIcon,
  video: VideoIcon,
  wallpaper: WallpaperIcon,

  // Time & Location
  diningTable: TableRestaurantIcon,
  event: EventIcon,
  location: LocationIcon,
  time: AccessTimeIcon,

  // Domain-Specific / App Features
  adminPanel: AdminPanelSettingsIcon,
  appRegister: AppRegistrationIcon,
  assignment: AssignmentIcon,
  business: BusinessIcon,
  checkin: HowToRegIcon,
  copy: ContentCopyIcon,
  flash: FlashOnIcon,
  games: SportsEsportsIcon,
  grid: GridViewIcon,
  insights: InsightsIcon,
  key: KeyIcon,
  peopleAlt: PeopleAltIcon,
  person: PersonIcon,
  poll: PollIcon,
  print: PrintIcon,
  qrCodeScanner: QrCodeScannerIcon,
  qrcode: QrCodeIcon,
  quiz: QuizIcon,
  trophy: EmojiEventsIcon,

  // Social Media
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  twitter: TwitterIcon,
  whatsapp: WhatsAppIcon,

  // Screen Sharing / Devices
  cast: CastIcon,
  connectedTv: ConnectedTvIcon,
  desktop: DesktopWindowsIcon,
  developerBoard: DeveloperBoardIcon,
  devices: DevicesIcon,
  laptop: LaptopIcon,
  monitor: MonitorIcon,
  phoneAndroid: PhoneAndroidIcon,
  phoneIphone: PhoneIphoneIcon,
  screenShare: ScreenShareIcon,
  settingsInputComponent: SettingsInputComponentIcon,
  settingsInputHdmi: SettingsInputHdmiIcon,
  smartDisplay: SmartDisplayIcon,
  tablet: TabletMacIcon,
  tv: TvIcon,

  // Outlined / Extras
  apartment: ApartmentOutlinedIcon,
  assignmentOutline: AssignmentOutlinedIcon,
  emailOutline: EmailOutlinedIcon,
  eventOutline: EventOutlinedIcon,
  personOutline: PersonOutlineIcon,
  timeOutline: QueryBuilderOutlinedIcon,
  verified: VerifiedOutlinedIcon,
  vpnKey: VpnKeyOutlinedIcon,

  // Miscellaneous
  chat: ChatIcon,
  clear: ClearIcon,
  cloud: CloudIcon,
  description: DescriptionIcon,
  desk: DeskIcon,
  door: DoorIcon,
  email: EmailIcon,
  empty: EmptyIcon,
  forum: ForumIcon,
  group: GroupIcon,
  help: HelpIcon,
  people: PeopleIcon,
  phone: PhoneIcon,
  refresh: RefreshIcon,
  send: SendIcon,
  thumb: ThumbUpIcon,
  thumbOff: ThumbUpOffAltIcon,
};

export default ICONS;
