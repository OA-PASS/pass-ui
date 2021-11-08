import Controller from "@ember/controller";
import { tracked } from "@glimmer/tracking";
import Bootstrap4Theme from "ember-models-table/themes/bootstrap4";
import { inject as service } from "@ember/service";

export default class GrantsIndexController extends Controller {
  @service currentUser;
  @service("app-static-config") configurator;

  constructor() {
    super(...arguments);

    this.configurator
      .getStaticConfig()
      .then((config) => this.set("assetsUri", config.assetsUri));
  }

  themeInstance = Bootstrap4Theme.create();
  // TODO Reduce duplication in column definitions
  adminColumns = [
    {
      propertyName: "grant.projectName",
      title: "Project Name",
      className: "projectname-column",
      component: "grant-link-cell",
    },
    {
      propertyName: "grant.primaryFunder.name",
      title: "Funder",
      className: "funder-column",
      filterWithSelect: true,
      predefinedFilterOptions: ["NIH", "DOE", "NSF"],
    },
    {
      propertyName: "grant.awardNumber",
      title: "Award Number",
      className: "awardnum-column",
      disableFiltering: true,
      component: "grant-link-cell",
    },
    {
      title: "PI",
      propertyName: "grant.pi",
      component: "pi-list-cell",
    },
    {
      propertyName: "grant.startDate",
      title: "Start",
      disableFiltering: true,
      className: "date-column",
      component: "date-cell",
    },
    {
      propertyName: "grant.endDate",
      title: "End",
      disableFiltering: true,
      className: "date-column",
      component: "date-cell",
    },
    {
      propertyName: "grant.awardStatus",
      title: "Status",
      filterWithSelect: true,
      predefinedFilterOptions: ["Active", "Ended"],
    },
    {
      propertyName: "submissions.length",
      title: "Submissions count",
      disableFiltering: true,
      component: "grant-link-cell",
    },
    {
      propertyName: "grant.oapCompliance",
      title: "OAP Compliance",
      component: "oap-compliance-cell",
      filterWithSelect: true,
      predefinedFilterOptions: ["No", "Yes"],
    },
  ];

  @tracked assetsUri = null;
  // Bound to message dialog.
  @tracked messageShow = false;
  @tracked messageTo = "";
  @tracked messageSubject = "";
  @tracked messageText = "";
  @tracked tablePageSize = 50;
  @tracked tablePageSizeValues = [10, 25, 50];
  @tracked user = this.currentUser.user;

  // Columns displayed depend on the user role
  get columns() {
    return this.adminColumns;
  }
}
